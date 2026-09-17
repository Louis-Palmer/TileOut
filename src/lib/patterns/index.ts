import type { TilePattern } from "./types";
import { straightGridPattern } from "./grid";
import { herringbonePattern } from "./herringbone";

export const patterns: TilePattern[] = [straightGridPattern, herringbonePattern];

export function getPatternById(id: string): TilePattern {
  return patterns.find((pattern) => pattern.id === id) ?? patterns[0];
}

export * from "./types";
export { withRotation } from "./withRotation";
export { findBestRotationAngle } from "./findBestRotation";
export type { RotationSearchOptions, RotationSearchResult } from "./findBestRotation";
