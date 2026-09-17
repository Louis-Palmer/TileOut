import type { RoomShape } from "../shapes/types";
import type { TileSize } from "../tiles/types";
import { triangulateRoom } from "../shapes/clip";
import type { PiecePlacement, TilePattern } from "./types";
import { placeTile } from "./placeTile";

// Tiles placed left-to-right, top-to-bottom, all square to the walls,
// starting from the top-left corner. Edge tiles are trimmed to fit —
// against the room's actual boundary, straight or not, via placeTile.
export const straightGridPattern: TilePattern = {
  id: "straight-grid",
  name: "Straight (all tiles square to the walls)",
  layout(room: RoomShape, tile: TileSize, groutMm: number): PiecePlacement[] {
    const { widthMm, lengthMm } = room.boundingBox;
    const triangulation = triangulateRoom(room);
    const placements: PiecePlacement[] = [];

    for (let y = 0; y < lengthMm; y += tile.heightMm + groutMm) {
      for (let x = 0; x < widthMm; x += tile.widthMm + groutMm) {
        placements.push(
          ...placeTile(triangulation, x, y, tile.widthMm, tile.heightMm, tile.widthMm, tile.heightMm)
        );
      }
    }

    return placements;
  },
};
