import type { RoomShape } from "./shapes/types";
import type { TileSize } from "./tiles/types";
import type { TilePattern } from "./patterns/types";

export interface Offcut {
  width: number;
  height: number;
}

export interface TilingResult {
  totalPieces: number;
  fullTiles: number;
  cutPieces: number;
  freshTilesUsed: number;
  piecesFromReusedOffcuts: number;
  leftoverOffcuts: Offcut[];
}

// Runs a pattern's layout against a tile size, then works out how many
// whole/fresh tiles are actually needed once cut offcuts are reused for
// later cuts wherever they're big enough. This reuse step is pattern- and
// shape-agnostic, so it works unchanged for future room shapes/patterns.
export function calculateTiling(
  room: RoomShape,
  tile: TileSize,
  pattern: TilePattern
): TilingResult {
  const placements = pattern.layout(room, tile);
  const offcutPool: Offcut[] = [];

  let fullTiles = 0;
  let cutPieces = 0;
  let freshTilesUsed = 0;
  let piecesFromReusedOffcuts = 0;

  for (const piece of placements) {
    if (!piece.cut) {
      fullTiles++;
      freshTilesUsed++;
      continue;
    }

    cutPieces++;

    const reusableIndex = offcutPool.findIndex(
      (offcut) => offcut.width >= piece.width && offcut.height >= piece.height
    );

    if (reusableIndex >= 0) {
      const [offcut] = offcutPool.splice(reusableIndex, 1);
      piecesFromReusedOffcuts++;
      addLeftovers(offcutPool, offcut, piece.width, piece.height);
    } else {
      freshTilesUsed++;
      addLeftovers(offcutPool, { width: tile.widthMm, height: tile.heightMm }, piece.width, piece.height);
    }
  }

  return {
    totalPieces: placements.length,
    fullTiles,
    cutPieces,
    freshTilesUsed,
    piecesFromReusedOffcuts,
    leftoverOffcuts: offcutPool,
  };
}

// Cutting `pieceWidth x pieceHeight` out of a `source` rectangle leaves an
// L-shaped remainder. Splitting it into two strips is a simplification
// (a guillotine cut) but keeps the offcut pool easy to reason about.
function addLeftovers(
  pool: Offcut[],
  source: Offcut,
  pieceWidth: number,
  pieceHeight: number
) {
  const leftoverWidth = source.width - pieceWidth;
  const leftoverHeight = source.height - pieceHeight;

  if (leftoverWidth > 0) {
    pool.push({ width: leftoverWidth, height: pieceHeight });
  }
  if (leftoverHeight > 0) {
    pool.push({ width: source.width, height: leftoverHeight });
  }
}

export interface PacksNeeded {
  packs: number;
  spareTiles: number;
}

export function calculatePacksNeeded(freshTilesUsed: number, tilesPerPack: number): PacksNeeded {
  const packs = Math.ceil(freshTilesUsed / tilesPerPack);
  const spareTiles = packs * tilesPerPack - freshTilesUsed;
  return { packs, spareTiles };
}
