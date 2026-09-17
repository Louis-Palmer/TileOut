import type { Point, RoomShape } from "./types";
import { centroidOf, createPolygonRoom } from "./polygon";

export function rotatePoint(p: Point, angleDeg: number, pivot: Point): Point {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - pivot.x;
  const dy = p.y - pivot.y;
  return {
    x: pivot.x + dx * cos - dy * sin,
    y: pivot.y + dx * sin + dy * cos,
  };
}

// Rotates a room around its own centroid so a pattern can be laid out
// axis-aligned against the rotated shape (equivalent to laying the real
// pattern out at an angle against the real room) — the whole tiling engine
// stays untouched, it just sees a differently-oriented room polygon.
//
// `createPolygonRoom` normalizes (translates) whatever vertices it's given
// so the bounding box starts at (0,0). That translation happens *after*
// the rotation below, so undoing the whole thing to get back to the room's
// real coordinates means undoing the translation first, then the rotation
// (reversing a composition reverses its order) — getting that order
// backwards is the likely way to get this wrong, since the result would
// still look like a plausible tiled room, just silently offset from the
// real one.
export function rotateRoom(
  room: RoomShape,
  angleDeg: number
): { rotatedRoom: RoomShape; toOriginalFrame: (p: Point) => Point } {
  const pivot = centroidOf(room.vertices); // captured once, shared by both directions below
  const rotatedVertices = room.vertices.map((v) => rotatePoint(v, -angleDeg, pivot));

  const minX = Math.min(...rotatedVertices.map((v) => v.x));
  const minY = Math.min(...rotatedVertices.map((v) => v.y));
  const rotatedRoom = createPolygonRoom(rotatedVertices, room.type);

  const toOriginalFrame = (p: Point): Point =>
    rotatePoint({ x: p.x + minX, y: p.y + minY }, angleDeg, pivot);

  return { rotatedRoom, toOriginalFrame };
}
