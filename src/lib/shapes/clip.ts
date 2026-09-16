import earcut from "earcut";
import type { Point, RoomShape } from "./types";

// A room polygon can be concave (an L-shape), so clipping a candidate tile
// rectangle against it isn't a single convex clip. Instead the room is
// triangulated once (every triangle is convex), the tile rect is clipped
// against each triangle separately (always valid, since both shapes are
// convex), and same-tile fragments from adjacent triangles are merged back
// together — this avoids ever needing general polygon-union code, which is
// where the real risk (T-junctions, sliver/adjacency bugs) would otherwise
// be.
export interface RoomTriangulation {
  triangles: [Point, Point, Point][];
  // adjacency[i] = indices of triangles sharing an internal diagonal with
  // triangle i (i.e. NOT a real room-boundary edge).
  adjacency: number[][];
}

export function triangulateRoom(room: RoomShape): RoomTriangulation {
  const n = room.vertices.length;
  const flat: number[] = [];
  for (const v of room.vertices) flat.push(v.x, v.y);

  const indices = earcut(flat);
  const triangleCount = indices.length / 3;
  const triangleIndices: [number, number, number][] = [];
  const triangles: [Point, Point, Point][] = [];

  for (let t = 0; t < triangleCount; t++) {
    const ia = indices[t * 3];
    const ib = indices[t * 3 + 1];
    const ic = indices[t * 3 + 2];
    triangleIndices.push([ia, ib, ic]);
    triangles.push([room.vertices[ia], room.vertices[ib], room.vertices[ic]]);
  }

  const isBoundaryEdge = (i: number, j: number) => {
    const diff = Math.abs(i - j);
    return diff === 1 || diff === n - 1;
  };

  const edgeOwners = new Map<string, number[]>();
  const adjacency: number[][] = triangles.map(() => []);

  for (let t = 0; t < triangleCount; t++) {
    const [ia, ib, ic] = triangleIndices[t];
    const edges: [number, number][] = [
      [ia, ib],
      [ib, ic],
      [ic, ia],
    ];
    for (const [i, j] of edges) {
      if (isBoundaryEdge(i, j)) continue;
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      const owners = edgeOwners.get(key);
      if (owners) {
        for (const other of owners) {
          adjacency[t].push(other);
          adjacency[other].push(t);
        }
        owners.push(t);
      } else {
        edgeOwners.set(key, [t]);
      }
    }
  }

  return { triangles, adjacency };
}

export interface ClippedFragment {
  // Convex sub-polygons whose union is this piece's true footprint — kept
  // separate (rather than merged into one outline) so rendering doesn't
  // need any polygon-union code either.
  polygons: Point[][];
  boundingBox: { x: number; y: number; width: number; height: number };
  isPlainRect: boolean;
}

const AREA_EPSILON = 1e-6;

export function clipTileToRoom(
  triangulation: RoomTriangulation,
  x: number,
  y: number,
  width: number,
  height: number
): ClippedFragment[] {
  const rect: Point[] = [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];

  const fragments: (Point[] | null)[] = triangulation.triangles.map((triangle) => {
    const clipped = sutherlandHodgmanClip(rect, triangle);
    if (clipped.length < 3 || polygonArea(clipped) < AREA_EPSILON) return null;
    return clipped;
  });

  const triangleCount = triangulation.triangles.length;
  const parent = Array.from({ length: triangleCount }, (_, i) => i);
  function find(i: number): number {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  }
  function union(a: number, b: number) {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootA] = rootB;
  }

  for (let t = 0; t < triangleCount; t++) {
    if (!fragments[t]) continue;
    for (const neighbor of triangulation.adjacency[t]) {
      if (fragments[neighbor]) union(t, neighbor);
    }
  }

  const groups = new Map<number, number[]>();
  for (let t = 0; t < triangleCount; t++) {
    if (!fragments[t]) continue;
    const root = find(t);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(t);
  }

  const result: ClippedFragment[] = [];
  for (const triangleIdxs of groups.values()) {
    const rawPolygons = triangleIdxs.map((t) => fragments[t]!);
    const allPoints = rawPolygons.flat();
    const minX = Math.min(...allPoints.map((p) => p.x));
    const maxX = Math.max(...allPoints.map((p) => p.x));
    const minY = Math.min(...allPoints.map((p) => p.y));
    const maxY = Math.max(...allPoints.map((p) => p.y));
    const bbWidth = maxX - minX;
    const bbHeight = maxY - minY;
    const totalArea = rawPolygons.reduce((sum, poly) => sum + polygonArea(poly), 0);
    const bbArea = bbWidth * bbHeight;
    const isPlainRect = Math.abs(totalArea - bbArea) < Math.max(1, bbArea * 1e-6);

    // Only bother reconstructing the true outline for pieces that actually
    // get rendered as a polygon (plain-rect pieces are drawn as a <rect>
    // instead, so their raw per-triangle fragments are never used).
    const polygons = isPlainRect ? rawPolygons : mergeFragmentsToOutline(rawPolygons);

    result.push({
      polygons,
      boundingBox: { x: minX, y: minY, width: bbWidth, height: bbHeight },
      isPlainRect,
    });
  }

  return result;
}

const POINT_KEY_PRECISION = 100; // round to the nearest 0.01mm before matching

function pointKey(p: Point): string {
  return `${Math.round(p.x * POINT_KEY_PRECISION)},${Math.round(p.y * POINT_KEY_PRECISION)}`;
}

// Adjacent triangle fragments share their internal diagonal exactly,
// traversed in opposite directions (earcut's triangles are consistently
// wound) — so the piece's true outline is found by cancelling any edge
// that appears once forward and once backward across the fragment set,
// leaving only edges that are genuinely part of the outline (the tile's
// own edges, or the room's real boundary). This is what stops an internal
// triangulation seam from being drawn as a stray line through a cut piece.
function mergeFragmentsToOutline(polygons: Point[][]): Point[][] {
  const edges = new Map<string, { a: Point; b: Point }>();
  for (const polygon of polygons) {
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      const forwardKey = `${pointKey(a)}>${pointKey(b)}`;
      const reverseKey = `${pointKey(b)}>${pointKey(a)}`;
      if (edges.has(reverseKey)) {
        edges.delete(reverseKey);
      } else {
        edges.set(forwardKey, { a, b });
      }
    }
  }

  const remaining = Array.from(edges.values());
  const byStartKey = new Map<string, { a: Point; b: Point }[]>();
  for (const edge of remaining) {
    const key = pointKey(edge.a);
    if (!byStartKey.has(key)) byStartKey.set(key, []);
    byStartKey.get(key)!.push(edge);
  }

  const used = new Set<{ a: Point; b: Point }>();
  const loops: Point[][] = [];

  for (const startEdge of remaining) {
    if (used.has(startEdge)) continue;
    const startKey = pointKey(startEdge.a);
    const loop: Point[] = [];
    let current: { a: Point; b: Point } | undefined = startEdge;
    while (current) {
      used.add(current);
      loop.push(current.a);
      if (pointKey(current.b) === startKey) break;
      current = (byStartKey.get(pointKey(current.b)) ?? []).find((e) => !used.has(e));
    }
    if (loop.length >= 3) loops.push(loop);
  }

  return loops.length > 0 ? loops : polygons;
}

function polygonArea(polygon: Point[]): number {
  return Math.abs(signedArea(polygon));
}

function signedArea(polygon: Point[]): number {
  let sum = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

// Clips `subject` (any simple polygon) against `clipPolygon` (must be
// convex — true for the triangles this is used with). Standard
// Sutherland–Hodgman: walk each clip edge in turn, keeping only the part
// of the running result on the polygon's own inside.
function sutherlandHodgmanClip(subject: Point[], clipPolygon: Point[]): Point[] {
  const clockwise = signedArea(clipPolygon) < 0;
  let output = subject;

  for (let i = 0; i < clipPolygon.length && output.length > 0; i++) {
    const edgeStart = clipPolygon[i];
    const edgeEnd = clipPolygon[(i + 1) % clipPolygon.length];
    const input = output;
    output = [];

    for (let j = 0; j < input.length; j++) {
      const current = input[j];
      const previous = input[(j - 1 + input.length) % input.length];
      const currentInside = isInside(current, edgeStart, edgeEnd, clockwise);
      const previousInside = isInside(previous, edgeStart, edgeEnd, clockwise);

      if (currentInside) {
        if (!previousInside) {
          output.push(lineIntersection(previous, current, edgeStart, edgeEnd));
        }
        output.push(current);
      } else if (previousInside) {
        output.push(lineIntersection(previous, current, edgeStart, edgeEnd));
      }
    }
  }

  return output;
}

function isInside(point: Point, edgeStart: Point, edgeEnd: Point, clockwise: boolean): boolean {
  const cross =
    (edgeEnd.x - edgeStart.x) * (point.y - edgeStart.y) -
    (edgeEnd.y - edgeStart.y) * (point.x - edgeStart.x);
  return clockwise ? cross <= 0 : cross >= 0;
}

function lineIntersection(a: Point, b: Point, c: Point, d: Point): Point {
  const a1 = b.y - a.y;
  const b1 = a.x - b.x;
  const c1 = a1 * a.x + b1 * a.y;
  const a2 = d.y - c.y;
  const b2 = c.x - d.x;
  const c2 = a2 * c.x + b2 * c.y;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1e-9) return a;
  return { x: (b2 * c1 - b1 * c2) / det, y: (a1 * c2 - a2 * c1) / det };
}
