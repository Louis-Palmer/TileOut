import type { Point, RoomShape } from "../shapes/types";
import type { TileSize } from "../tiles/types";

// One tile's position and size within the room, in millimetres from the
// room's top-left corner. `x`/`y`/`width`/`height` are always this piece's
// bounding box (what the offcut-reuse engine reads). `cut: true` means this
// piece is smaller than a full tile (an edge/corner piece that had to be
// trimmed to fit). `sourceWidth`/`sourceHeight` is the size of the *uncut*
// tile this piece was cut from, in the orientation it was placed — for a
// pattern that only ever places tiles one way round (straight/grid) this is
// just the tile's own size, but a pattern that rotates tiles between
// placements (herringbone) needs this to tell the offcut-reuse engine how
// much material was actually left over from the cut.
// `shape`, when present, is this piece's true footprint as one or more
// convex polygons (a room boundary that isn't a plain rectangle can carve a
// non-rectangular notch out of an edge tile) — absent for every piece in a
// rectangular room, and for unaffected pieces in an irregular one.
export interface PiecePlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  cut: boolean;
  sourceWidth: number;
  sourceHeight: number;
  shape?: Point[][];
}

// A pattern turns a room + tile size + grout width into a list of piece
// placements. "Straight/grid" and "herringbone" are the implementations so
// far; new patterns implement this same interface without touching the
// calculation engine. `groutMm` only ever affects spacing between tile
// positions — it never changes a piece's own material size (`width`/
// `height`/`sourceWidth`/`sourceHeight`), so the offcut-reuse engine in
// tiling.ts needs no awareness of it at all.
export interface TilePattern {
  readonly id: string;
  readonly name: string;
  layout(room: RoomShape, tile: TileSize, groutMm: number): PiecePlacement[];
}
