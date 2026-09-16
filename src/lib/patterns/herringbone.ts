import type { RoomShape } from "../shapes/types";
import type { TileSize } from "../tiles/types";
import { triangulateRoom } from "../shapes/clip";
import type { PiecePlacement, TilePattern } from "./types";
import { placeTile } from "./placeTile";

// Straight (0/90°) herringbone: tiles alternate between a "long ways"
// orientation and a "short ways" orientation rotated 90° from it, forming
// the classic zigzag, while each individual tile stays square to the walls
// (a 45°-rotated "diagonal herringbone" is a different, future pattern).
//
// The construction is a repeated "staircase": starting from a tile, the
// next tile in the chain is rotated 90° and offset by (long - short, short)
// from it, which advances the whole pair by (long, long). A single such
// staircase only covers one diagonal strip of the room, so the full
// pattern is that staircase repeated at every integer offset of
// (short, -short) — this offset is what makes neighbouring staircases
// interlock with no gaps or overlaps (verified numerically, not just by
// eye, before writing this: see the derivation notes for this change).
export const herringbonePattern: TilePattern = {
  id: "herringbone",
  name: "Herringbone",
  layout(room: RoomShape, tile: TileSize): PiecePlacement[] {
    const { widthMm, lengthMm } = room.boundingBox;
    const long = Math.max(tile.widthMm, tile.heightMm);
    const short = Math.min(tile.widthMm, tile.heightMm);
    if (long <= 0 || short <= 0) return [];

    const triangulation = triangulateRoom(room);
    const placements: PiecePlacement[] = [];

    // How far the staircase/run indices need to range to cover the room's
    // bounding box (already the full extent of the room, concave or not),
    // plus one extra step of margin on each side.
    const reach = widthMm + lengthMm;
    const runRange = Math.ceil(reach / short) + 1;
    const stepRange = Math.ceil(reach / long) + 1;

    for (let run = -runRange; run <= runRange; run++) {
      for (let step = -stepRange; step <= stepRange; step++) {
        const longX = run * short + step * long;
        const longY = -run * short + step * long;
        placements.push(...placeTile(triangulation, longX, longY, long, short, long, short));

        const shortX = longX + (long - short);
        const shortY = longY + short;
        placements.push(...placeTile(triangulation, shortX, shortY, short, long, short, long));
      }
    }

    return placements;
  },
};
