import type { RoomShape } from "../shapes/types";
import type { TileSize } from "../tiles/types";
import type { PiecePlacement, TilePattern } from "./types";

// Tiles placed left-to-right, top-to-bottom, all square to the walls,
// starting from the top-left corner. Edge tiles are trimmed to fit.
export const straightGridPattern: TilePattern = {
  id: "straight-grid",
  name: "Straight (all tiles square to the walls)",
  layout(room: RoomShape, tile: TileSize): PiecePlacement[] {
    const { widthMm, lengthMm } = room.boundingBox;
    const placements: PiecePlacement[] = [];

    for (let y = 0; y < lengthMm; y += tile.heightMm) {
      const height = Math.min(tile.heightMm, lengthMm - y);
      for (let x = 0; x < widthMm; x += tile.widthMm) {
        const width = Math.min(tile.widthMm, widthMm - x);
        placements.push({
          x,
          y,
          width,
          height,
          cut: width < tile.widthMm || height < tile.heightMm,
        });
      }
    }

    return placements;
  },
};
