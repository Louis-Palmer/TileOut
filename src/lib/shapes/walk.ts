import type { Point } from "./types";

// One wall as a person would measure it walking around the room: its
// length, and the interior angle of the corner they turn at the end of it
// to face the next wall (90° for a normal square corner; over 180° for a
// reflex/concave corner, e.g. the inner corner of an L-shaped room).
export interface WallInput {
  lengthMm: number;
  interiorAngleDeg: number;
}

export interface WalkResult {
  vertices: Point[];
  // Distance between where the walk ends and where it started — real
  // hand measurements rarely close exactly. Purely advisory: the returned
  // polygon is always geometrically closed (the trailing point is dropped,
  // not stored), this is just feedback for the user to sanity-check a wall
  // or angle if the gap looks large.
  closureErrorMm: number;
}

// Turtle graphics: walk forward by each wall's length, turn by the signed
// exterior angle (180° - interior angle) at each corner. This is the
// standard "sum of signed exterior angles of a simple polygon is ±360°"
// identity, which holds for reflex corners too (an interior angle over
// 180° just contributes a negative turn) — so a concave corner needs no
// special-casing, only that the angle input isn't clamped to ≤180°.
export function wallsToPolygon(walls: WallInput[]): WalkResult {
  let heading = 0; // degrees; 0 = facing +x
  let pos: Point = { x: 0, y: 0 };
  const points: Point[] = [pos];

  for (const wall of walls) {
    const radians = (heading * Math.PI) / 180;
    pos = {
      x: pos.x + wall.lengthMm * Math.cos(radians),
      y: pos.y + wall.lengthMm * Math.sin(radians),
    };
    points.push(pos);
    heading += 180 - wall.interiorAngleDeg;
  }

  const start = points[0];
  const end = points[points.length - 1];
  const closureErrorMm = Math.hypot(end.x - start.x, end.y - start.y);

  return { vertices: points.slice(0, -1), closureErrorMm };
}
