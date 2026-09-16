import type { RoomShape } from "./types";
import { createPolygonRoom } from "./polygon";

// A rectangle is just a 4-point polygon — routing through createPolygonRoom
// means it can never silently drift from the general polygon logic that
// every other room shape uses.
export function createRectangleRoom(widthMm: number, lengthMm: number): RoomShape {
  return createPolygonRoom(
    [
      { x: 0, y: 0 },
      { x: widthMm, y: 0 },
      { x: widthMm, y: lengthMm },
      { x: 0, y: lengthMm },
    ],
    "rectangle"
  );
}
