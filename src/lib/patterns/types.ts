import type { RoomShape } from "../shapes/types";
import type { TileSize } from "../tiles/types";

// One tile's position and size within the room, in millimetres from the
// room's top-left corner. `cut: true` means this piece is smaller than a
// full tile (an edge/corner piece that had to be trimmed to fit).
export interface PiecePlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  cut: boolean;
}

// A pattern turns a room + tile size into a list of piece placements.
// "Straight/grid" is the only implementation for the prototype; herringbone,
// diagonal, brick-bond etc. become new implementations of this same
// interface later, without touching the calculation engine.
export interface TilePattern {
  readonly id: string;
  readonly name: string;
  layout(room: RoomShape, tile: TileSize): PiecePlacement[];
}
