export interface RoomDimensions {
  widthMm: number;
  lengthMm: number;
}

// Every room shape (rectangle now, L-shape/custom polygons later) implements
// this. The tiling engine only ever talks to RoomShape, never to a concrete
// shape, so new shapes don't require changes anywhere else.
export interface RoomShape {
  readonly type: string;
  readonly areaM2: number;
  readonly boundingBox: RoomDimensions;
}
