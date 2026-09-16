import type { RoomShape } from "../shapes/types";
import type { TileSize } from "../tiles/types";

// One tile's position and size within the room, in millimetres from the
// room's top-left corner. `cut: true` means this piece is smaller than a
// full tile (an edge/corner piece that had to be trimmed to fit).
// `sourceWidth`/`sourceHeight` is the size of the *uncut* tile this piece
// was cut from, in the orientation it was placed — for a pattern that only
// ever places tiles one way round (straight/grid) this is just the tile's
// own size, but a pattern that rotates tiles between placements
// (herringbone) needs this to tell the offcut-reuse engine how much
// material was actually left over from the cut.
export interface PiecePlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  cut: boolean;
  sourceWidth: number;
  sourceHeight: number;
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
