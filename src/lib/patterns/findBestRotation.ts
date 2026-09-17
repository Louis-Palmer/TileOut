import type { RoomShape } from "../shapes/types";
import { rotateRoom } from "../shapes/rotate";
import type { TileSize } from "../tiles/types";
import { calculateTiling } from "../tiling";
import type { TilePattern } from "./types";

export interface RotationSearchOptions {
  coarseStepDeg?: number;
  fineWindowDeg?: number;
  fineStepDeg?: number;
  maxAngleDeg?: number;
}

export interface RotationSearchResult {
  angleDeg: number;
  freshTilesUsed: number;
  baselineFreshTilesUsed: number;
}

// Searches for the rotation angle that needs the fewest tiles, without
// ever recomputing anything more than a plain angle=0 layout unless this
// is explicitly called — this is deliberately *not* wired into any
// high-frequency interaction (e.g. dragging a room corner); it's meant to
// run once, on an explicit user action.
//
// Coarse-then-fine sweep: a first pass every few degrees across the full
// range, then a focused pass around whatever that found. 0-180 degrees,
// not 0-90 — the tempting shortcut ("a square tile only needs a quarter
// turn", "a rectangular tile's 90 degree rotation is just relabelling
// width/height") doesn't hold here, because the grid's starting offset
// isn't independently controlled: it falls out of wherever the *rotated*
// room's own bounding box happens to land, which shifts unpredictably
// with angle. So angle and angle+90 are genuinely different candidates for
// an irregular room, not a redundant re-check.
export function findBestRotationAngle(
  room: RoomShape,
  tile: TileSize,
  pattern: TilePattern,
  options: RotationSearchOptions = {}
): RotationSearchResult {
  const { coarseStepDeg = 5, fineWindowDeg = 4, fineStepDeg = 1, maxAngleDeg = 180 } = options;

  const baseline = calculateTiling(room, tile, pattern).freshTilesUsed;
  let best: RotationSearchResult = {
    angleDeg: 0,
    freshTilesUsed: baseline,
    baselineFreshTilesUsed: baseline,
  };

  const evaluate = (angleDeg: number) => {
    if (angleDeg === 0) return;
    const { rotatedRoom } = rotateRoom(room, angleDeg);
    const freshTilesUsed = calculateTiling(rotatedRoom, tile, pattern).freshTilesUsed;
    if (freshTilesUsed < best.freshTilesUsed) {
      best = { angleDeg, freshTilesUsed, baselineFreshTilesUsed: baseline };
    }
  };

  for (let angle = 0; angle <= maxAngleDeg; angle += coarseStepDeg) {
    evaluate(angle);
  }

  if (best.angleDeg !== 0) {
    for (let angle = best.angleDeg - fineWindowDeg; angle <= best.angleDeg + fineWindowDeg; angle += fineStepDeg) {
      if (angle >= 0 && angle <= maxAngleDeg) evaluate(angle);
    }
  }

  return best;
}
