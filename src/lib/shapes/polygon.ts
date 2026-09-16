import type { Point, RoomDimensions, RoomShape } from "./types";

// Shoelace formula, signed: positive for a counter-clockwise winding,
// negative for clockwise. The sign is what lets interior-angle labels tell
// convex from reflex corners regardless of which way a room happens to be
// wound (rectangle/walk-the-room both produce CCW, but nothing enforces
// that after a CAD-editor drag).
export function signedArea(vertices: Point[]): number {
  let sum = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

// Works for convex and concave (simple, non-self-intersecting) polygons
// alike.
export function computeArea(vertices: Point[]): number {
  return Math.abs(signedArea(vertices));
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

// Interior angle at each vertex, computed purely from the vertex
// positions — works regardless of how the room was built (rectangle,
// walked, or CAD-dragged) rather than trusting stored wall-input angles
// that a drag wouldn't have updated. Orientation-aware (via the sign of
// signedArea) so it reports the true interior angle whether the polygon
// happens to be wound clockwise or counter-clockwise.
export function interiorAnglesDeg(vertices: Point[]): number[] {
  const n = vertices.length;
  const orientation = signedArea(vertices) >= 0 ? 1 : -1;
  return vertices.map((curr, i) => {
    const prev = vertices[(i - 1 + n) % n];
    const next = vertices[(i + 1) % n];
    const inHeading = Math.atan2(curr.y - prev.y, curr.x - prev.x);
    const outHeading = Math.atan2(next.y - curr.y, next.x - curr.x);
    const turnDeg = normalizeAngleDeg(((outHeading - inHeading) * 180) / Math.PI);
    return 180 - orientation * turnDeg;
  });
}

function normalizeAngleDeg(deg: number): number {
  return ((deg + 180) % 360 + 360) % 360 - 180;
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

const CROSS_EPSILON = 1e-6;

function sign(value: number): -1 | 0 | 1 {
  if (value > CROSS_EPSILON) return 1;
  if (value < -CROSS_EPSILON) return -1;
  return 0;
}

function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const s1 = sign(cross(p3, p4, p1));
  const s2 = sign(cross(p3, p4, p2));
  const s3 = sign(cross(p1, p2, p3));
  const s4 = sign(cross(p1, p2, p4));
  return s1 !== 0 && s2 !== 0 && s1 !== s2 && s3 !== 0 && s4 !== 0 && s3 !== s4;
}

function cross(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}
