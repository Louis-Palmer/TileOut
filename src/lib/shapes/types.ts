export interface Point {
  x: number;
  y: number;
}

export interface RoomDimensions {
  widthMm: number;
  lengthMm: number;
}

// Every room shape (rectangle, L-shape, custom polygons) implements this.
// `vertices` are ordered polygon corners in mm, normalized so the room's
// bounding box starts at (0,0) — no duplicated closing point; edge N
// connects vertices[N-1] to vertices[0]. The tiling engine only ever talks
// to RoomShape, never to a concrete shape, so new shapes don't require
// changes anywhere else.
export interface RoomShape {
  readonly type: string;
  readonly areaM2: number;
  readonly boundingBox: RoomDimensions;
  readonly vertices: Point[];
}
