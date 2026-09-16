import { clipTileToRoom } from "../shapes/clip";
import type { RoomTriangulation } from "../shapes/clip";
import type { PiecePlacement } from "./types";

const EPSILON = 1e-6;

// Shared by every pattern: clips one candidate axis-aligned tile rect
// against the room (via the room's precomputed triangulation) and turns
// the result into zero, one, or more PiecePlacements — more than one when
// a concave room boundary genuinely splits the tile into separate physical
// pieces. This is the one place patterns gain irregular-room support; a
// rectangular room reduces to the same plain-rectangle clamp every pattern
// used to do inline.
export function placeTile(
  triangulation: RoomTriangulation,
  x: number,
  y: number,
  width: number,
  height: number,
  sourceWidth: number,
  sourceHeight: number
): PiecePlacement[] {
  const fragments = clipTileToRoom(triangulation, x, y, width, height);

  return fragments.map((fragment) => {
    const fullyUncut =
      fragment.isPlainRect &&
      Math.abs(fragment.boundingBox.width - width) < EPSILON &&
      Math.abs(fragment.boundingBox.height - height) < EPSILON;

    return {
      x: fragment.boundingBox.x,
      y: fragment.boundingBox.y,
      width: fragment.boundingBox.width,
      height: fragment.boundingBox.height,
      cut: !fullyUncut,
      sourceWidth,
      sourceHeight,
      shape: fragment.isPlainRect ? undefined : fragment.polygons,
    };
  });
}
