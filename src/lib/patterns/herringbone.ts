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
// next tile in the chain is rotated 90° and offset from it, which advances
// the whole pair diagonally. A single such staircase only covers one
// diagonal strip of the room, so the full pattern is that staircase
// repeated at every integer offset of a second vector — this offset is
// what makes neighbouring staircases interlock with no gaps or overlaps
// (verified numerically, not just by eye, before writing this: see the
// derivation notes for this change).
//
// With grout, tile *positions* are computed by running the exact
// zero-grout formula above against virtual tiles inflated by the grout
// width (`long+grout`, `short+grout`) — those virtual tiles are proven to
// tile the plane with no gaps — then the true-size tile is placed CENTRED
// inside its virtual cell (not anchored to a corner). Centring matters:
// different virtual cells are neighbours via different edges depending on
// where they sit in the zigzag, so anchoring the true tile at the same
// corner every time leaves an inconsistent gap; centring is
// neighbour-direction-agnostic and produces exactly `grout` of gap
// regardless of which side the neighbour is on. Verified computationally
// (no tile pair closer than `grout`, no unexplained hole bigger than the
// geometry allows) across several tile aspect ratios and grout widths
// before trusting this.
export const herringbonePattern: TilePattern = {
  id: "herringbone",
  name: "Herringbone",
  layout(room: RoomShape, tile: TileSize, groutMm: number): PiecePlacement[] {
    const { widthMm, lengthMm } = room.boundingBox;
    const long = Math.max(tile.widthMm, tile.heightMm);
    const short = Math.min(tile.widthMm, tile.heightMm);
    if (long <= 0 || short <= 0) return [];

    const longWithGrout = long + groutMm;
    const shortWithGrout = short + groutMm;
    const halfGrout = groutMm / 2;

    const triangulation = triangulateRoom(room);
    const placements: PiecePlacement[] = [];

    // How far the staircase/run indices need to range to cover the room's
    // bounding box (already the full extent of the room, concave or not),
    // plus one extra step of margin on each side.
    const reach = widthMm + lengthMm;
    const runRange = Math.ceil(reach / shortWithGrout) + 1;
    const stepRange = Math.ceil(reach / longWithGrout) + 1;

    for (let run = -runRange; run <= runRange; run++) {
      for (let step = -stepRange; step <= stepRange; step++) {
        const longCellX = run * shortWithGrout + step * longWithGrout;
        const longCellY = -run * shortWithGrout + step * longWithGrout;
        placements.push(
          ...placeTile(triangulation, longCellX + halfGrout, longCellY + halfGrout, long, short, long, short)
        );

        const shortCellX = longCellX + (longWithGrout - shortWithGrout);
        const shortCellY = longCellY + shortWithGrout;
        placements.push(
          ...placeTile(triangulation, shortCellX + halfGrout, shortCellY + halfGrout, short, long, short, long)
        );
      }
    }

    return placements;
  },
};
