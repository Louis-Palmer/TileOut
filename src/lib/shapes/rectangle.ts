import type { RoomShape } from "./types";

export function createRectangleRoom(widthMm: number, lengthMm: number): RoomShape {
  return {
    type: "rectangle",
    areaM2: (widthMm * lengthMm) / 1_000_000,
    boundingBox: { widthMm, lengthMm },
  };
}
