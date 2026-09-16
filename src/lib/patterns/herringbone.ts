import type { RoomShape } from "../shapes/types";
import type { TileSize } from "../tiles/types";
import type { PiecePlacement, TilePattern } from "./types";

const EPSILON = 1e-6;

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

    const placements: PiecePlacement[] = [];

    // How far the staircase/run indices need to range to cover the room,
    // plus one extra step of margin on each side.
    const reach = widthMm + lengthMm;
    const runRange = Math.ceil(reach / short) + 1;
    const stepRange = Math.ceil(reach / long) + 1;

    for (let run = -runRange; run <= runRange; run++) {
      for (let step = -stepRange; step <= stepRange; step++) {
        const longX = run * short + step * long;
        const longY = -run * short + step * long;
        addClippedPiece(placements, longX, longY, long, short, widthMm, lengthMm);

        const shortX = longX + (long - short);
        const shortY = longY + short;
        addClippedPiece(placements, shortX, shortY, short, long, widthMm, lengthMm);
      }
    }

    return placements;
  },
};

function addClippedPiece(
  placements: PiecePlacement[],
  x: number,
  y: number,
  width: number,
  height: number,
  roomWidth: number,
  roomLength: number
) {
  const x0 = Math.max(x, 0);
  const y0 = Math.max(y, 0);
  const x1 = Math.min(x + width, roomWidth);
  const y1 = Math.min(y + height, roomLength);
  if (x1 - x0 <= EPSILON || y1 - y0 <= EPSILON) return;

  const clippedWidth = x1 - x0;
  const clippedHeight = y1 - y0;

  placements.push({
    x: x0,
    y: y0,
    width: clippedWidth,
    height: clippedHeight,
    cut: clippedWidth < width - EPSILON || clippedHeight < height - EPSILON,
    sourceWidth: width,
    sourceHeight: height,
  });
}
