export interface TileSize {
  widthMm: number;
  heightMm: number;
}

export interface TilePreset extends TileSize {
  id: string;
  name: string;
  tilesPerPack: number;
  pricePerPack?: number;
}
