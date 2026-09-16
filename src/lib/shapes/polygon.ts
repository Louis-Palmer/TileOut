import type { Point, RoomDimensions, RoomShape } from "./types";

// Shoelace formula. Works for convex and concave (simple, non-self-
// intersecting) polygons alike.
export function computeArea(vertices: Point[]): number {
  let sum = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export function computeBoundingBox(vertices: Point[]): RoomDimensions {
  const xs = vertices.map((v) => v.x);
  const ys = vertices.map((v) => v.y);
  return {
    widthMm: Math.max(...xs) - Math.min(...xs),
    lengthMm: Math.max(...ys) - Math.min(...ys),
  };
}

// Translates every point so the polygon's bounding box starts at (0,0),
// which is the coordinate space every room shape is expected to live in.
export function normalizeToOrigin(vertices: Point[]): Point[] {
  const xs = vertices.map((v) => v.x);
  const ys = vertices.map((v) => v.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return vertices.map((v) => ({ x: v.x - minX, y: v.y - minY }));
}

export function createPolygonRoom(vertices: Point[], type: string = "irregular"): RoomShape {
  const normalized = normalizeToOrigin(vertices);
  return {
    type,
    areaM2: computeArea(normalized) / 1_000_000,
    boundingBox: computeBoundingBox(normalized),
    vertices: normalized,
  };
}

// Used to guard interactive edits (dragging a corner): the triangulation-
// based clipping this app relies on assumes a simple (non-self-
// intersecting) polygon, so a candidate edit is rejected if it would cross
// any non-adjacent edge.
export function isSimplePolygon(vertices: Point[]): boolean {
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const a1 = vertices[i];
    const a2 = vertices[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      const adjacent = j === i || (j + 1) % n === i || (i + 1) % n === j;
      if (adjacent) continue;
      if (segmentsIntersect(a1, a2, vertices[j], vertices[(j + 1) % n])) return false;
    }
  }
  return true;
}

function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);
  return (d1 > 0 !== d2 > 0) && (d1 !== 0 && d2 !== 0) && (d3 > 0 !== d4 > 0) && (d3 !== 0 && d4 !== 0);
}

function cross(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}
