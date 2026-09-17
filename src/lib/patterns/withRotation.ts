import type { Point } from "../shapes/types";
import { rotateRoom } from "../shapes/rotate";
import type { PiecePlacement, TilePattern } from "./types";

function rectCorners(x: number, y: number, width: number, height: number): Point[] {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

// Wraps any TilePattern so it lays out at an angle relative to the room,
// reusing the pattern's own layout logic unchanged: the room is rotated by
// -angleDeg, the pattern lays out against that rotated room exactly as it
// normally would, and the resulting pieces are mapped back into the real
// room's coordinates for display.
//
// Only `shape` is mapped into the display frame. `x`/`y`/`width`/`height`/
// `cut`/`sourceWidth`/`sourceHeight` are left exactly as the wrapped
// pattern produced them, on purpose: they describe the piece's true cut
// size, which calculateTiling's offcut-reuse matching depends on, and a
// rotated rectangle's axis-aligned bounding box is generally *larger* than
// its real size — overwriting them with that bounding box would silently
// inflate freshTilesUsed for any angle that isn't a multiple of 90°.
// RoomDiagram never reads x/y once `shape` is set, so leaving them stale
// (in the rotated pattern's own working frame, not the display frame) is
// harmless.
export function withRotation(pattern: TilePattern, angleDeg: number): TilePattern {
  if (angleDeg === 0) return pattern;

  return {
    id: pattern.id,
    name: pattern.name,
    layout(room, tile, groutMm) {
      const { rotatedRoom, toOriginalFrame } = rotateRoom(room, angleDeg);
      const placements = pattern.layout(rotatedRoom, tile, groutMm);
      return placements.map((piece): PiecePlacement => {
        const localPolygons = piece.shape ?? [rectCorners(piece.x, piece.y, piece.width, piece.height)];
        return {
          ...piece,
          shape: localPolygons.map((polygon) => polygon.map(toOriginalFrame)),
        };
      });
    },
  };
}
