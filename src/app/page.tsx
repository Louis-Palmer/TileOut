"use client";

import { useMemo, useState } from "react";
import { createRectangleRoom } from "@/lib/shapes/rectangle";
import { createPolygonRoom } from "@/lib/shapes/polygon";
import { wallsToPolygon, type WallInput } from "@/lib/shapes/walk";
import type { Point } from "@/lib/shapes/types";
import { getPatternById, patterns } from "@/lib/patterns";
import { calculatePacksNeeded, calculateTiling } from "@/lib/tiling";
import type { TilePreset } from "@/lib/tiles/types";
import { RoomDiagram } from "@/components/RoomDiagram";
import { WallList } from "@/components/WallList";
import tilePresets from "@/data/tile-presets.json";

const presets = tilePresets as TilePreset[];
const CUSTOM_TILE_ID = "custom";

type RoomShapeMode = "rectangle" | "irregular";

const DEFAULT_WALLS: WallInput[] = [
  { lengthMm: 4000, interiorAngleDeg: 90 },
  { lengthMm: 3000, interiorAngleDeg: 90 },
  { lengthMm: 4000, interiorAngleDeg: 90 },
  { lengthMm: 3000, interiorAngleDeg: 90 },
];

export default function Home() {
  const [shapeMode, setShapeMode] = useState<RoomShapeMode>("rectangle");
  const [roomWidthM, setRoomWidthM] = useState("3");
  const [roomLengthM, setRoomLengthM] = useState("4");
  const [walls, setWalls] = useState<WallInput[]>(DEFAULT_WALLS);
  const [vertexOverrides, setVertexOverrides] = useState<Point[] | null>(null);
  const [cadEditing, setCadEditing] = useState(false);

  const [presetId, setPresetId] = useState<string>(presets[0].id);
  const [customWidthMm, setCustomWidthMm] = useState("300");
  const [customHeightMm, setCustomHeightMm] = useState("300");
  const [customTilesPerPack, setCustomTilesPerPack] = useState("10");

  const [patternId, setPatternId] = useState<string>(patterns[0].id);
  const selectedPattern = useMemo(() => getPatternById(patternId), [patternId]);

  const selectedTile = useMemo(() => {
    if (presetId === CUSTOM_TILE_ID) {
      return {
        widthMm: Number(customWidthMm) || 0,
        heightMm: Number(customHeightMm) || 0,
        tilesPerPack: Number(customTilesPerPack) || 1,
      };
    }
    const preset = presets.find((p) => p.id === presetId) ?? presets[0];
    return {
      widthMm: preset.widthMm,
      heightMm: preset.heightMm,
      tilesPerPack: preset.tilesPerPack,
    };
  }, [presetId, customWidthMm, customHeightMm, customTilesPerPack]);

  const widthM = Number(roomWidthM) || 0;
  const lengthM = Number(roomLengthM) || 0;

  const walked = useMemo(() => wallsToPolygon(walls), [walls]);

  const switchToIrregular = () => {
    setWalls([
      { lengthMm: widthM * 1000, interiorAngleDeg: 90 },
      { lengthMm: lengthM * 1000, interiorAngleDeg: 90 },
      { lengthMm: widthM * 1000, interiorAngleDeg: 90 },
      { lengthMm: lengthM * 1000, interiorAngleDeg: 90 },
    ]);
    setVertexOverrides(null);
    setShapeMode("irregular");
  };

  // Editing a wall means the wall list is authoritative again — drop any
  // corner nudges made in the CAD editor so the two inputs never fight.
  const handleWallsChange = (nextWalls: WallInput[]) => {
    setWalls(nextWalls);
    setVertexOverrides(null);
  };

  const room = useMemo(() => {
    if (shapeMode === "rectangle") {
      if (!(widthM > 0 && lengthM > 0)) return null;
      return createRectangleRoom(widthM * 1000, lengthM * 1000);
    }
    if (walls.length < 3 || walls.some((wall) => wall.lengthMm <= 0)) return null;
    return createPolygonRoom(vertexOverrides ?? walked.vertices);
  }, [shapeMode, widthM, lengthM, walls, walked, vertexOverrides]);

  const inputsAreValid = room !== null && selectedTile.widthMm > 0 && selectedTile.heightMm > 0;

  const result = useMemo(() => {
    if (!inputsAreValid || !room) return null;
    const tiling = calculateTiling(room, selectedTile, selectedPattern);
    const packs = calculatePacksNeeded(tiling.freshTilesUsed, selectedTile.tilesPerPack);
    return { room, tiling, packs };
  }, [room, selectedTile, selectedPattern, inputsAreValid]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <header>
        <h1 className="text-3xl font-bold sm:text-4xl">TileOut</h1>
        <p className="mt-2 text-lg text-gray-700 dark:text-gray-300">
          Work out how many tiles you need for a room, and see how they&apos;ll
          look laid out.
        </p>
      </header>

      <div className="flex flex-1 flex-col gap-8 lg:flex-row lg:items-start">
        <div className="flex w-full flex-col gap-6 lg:w-1/4 lg:min-w-[300px]">
          <section className="rounded-xl border-2 border-gray-300 p-6 dark:border-gray-700">
            <h2 className="text-2xl font-semibold">1. Room shape</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShapeMode("rectangle")}
                className={`rounded-lg border-2 px-4 py-3 text-lg font-semibold ${
                  shapeMode === "rectangle"
                    ? "border-blue-700 bg-blue-700 text-white"
                    : "border-gray-400 text-gray-700 dark:text-gray-300"
                }`}
              >
                Rectangle
              </button>
              <button
                type="button"
                onClick={switchToIrregular}
                className={`rounded-lg border-2 px-4 py-3 text-lg font-semibold ${
                  shapeMode === "irregular"
                    ? "border-blue-700 bg-blue-700 text-white"
                    : "border-gray-400 text-gray-700 dark:text-gray-300"
                }`}
              >
                Irregular room
              </button>
            </div>

            {shapeMode === "rectangle" ? (
              <>
                <p className="mt-4 text-base text-gray-600 dark:text-gray-400">
                  Measure the two longest walls, in metres.
                </p>
                <div className="mt-4 flex flex-col gap-4">
                  <label className="flex flex-col gap-2 text-lg">
                    Width (m)
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={roomWidthM}
                      onChange={(e) => setRoomWidthM(e.target.value)}
                      className="rounded-lg border-2 border-gray-400 px-4 py-3 text-xl dark:bg-gray-900"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-lg">
                    Length (m)
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={roomLengthM}
                      onChange={(e) => setRoomLengthM(e.target.value)}
                      className="rounded-lg border-2 border-gray-400 px-4 py-3 text-xl dark:bg-gray-900"
                    />
                  </label>
                </div>
              </>
            ) : (
              <>
                <p className="mt-4 text-base text-gray-600 dark:text-gray-400">
                  Walk around the room, entering each wall&apos;s length and the
                  angle you turn at the end of it (a normal square corner is
                  90°).
                </p>
                <div className="mt-4">
                  <WallList walls={walls} onChange={handleWallsChange} closureErrorMm={walked.closureErrorMm} />
                </div>
                <label className="mt-4 flex items-center gap-3 text-base">
                  <input
                    type="checkbox"
                    checked={cadEditing}
                    onChange={(e) => setCadEditing(e.target.checked)}
                    className="h-5 w-5"
                  />
                  Advanced: fine-tune corners by dragging them on the preview
                </label>
              </>
            )}
          </section>

          <section className="rounded-xl border-2 border-gray-300 p-6 dark:border-gray-700">
            <h2 className="text-2xl font-semibold">2. Tile size</h2>
            <p className="mt-1 text-base text-gray-600 dark:text-gray-400">
              Pick a common size, or enter your own from the tile box.
            </p>
            <label className="mt-4 flex flex-col gap-2 text-lg">
              Tile
              <select
                value={presetId}
                onChange={(e) => setPresetId(e.target.value)}
                className="rounded-lg border-2 border-gray-400 px-4 py-3 text-xl dark:bg-gray-900"
              >
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
                <option value={CUSTOM_TILE_ID}>Custom size&hellip;</option>
              </select>
            </label>

            {presetId === CUSTOM_TILE_ID && (
              <div className="mt-4 flex flex-col gap-4">
                <label className="flex flex-col gap-2 text-lg">
                  Width (mm)
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={customWidthMm}
                    onChange={(e) => setCustomWidthMm(e.target.value)}
                    className="rounded-lg border-2 border-gray-400 px-4 py-3 text-xl dark:bg-gray-900"
                  />
                </label>
                <label className="flex flex-col gap-2 text-lg">
                  Height (mm)
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={customHeightMm}
                    onChange={(e) => setCustomHeightMm(e.target.value)}
                    className="rounded-lg border-2 border-gray-400 px-4 py-3 text-xl dark:bg-gray-900"
                  />
                </label>
                <label className="flex flex-col gap-2 text-lg">
                  Tiles per pack
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={customTilesPerPack}
                    onChange={(e) => setCustomTilesPerPack(e.target.value)}
                    className="rounded-lg border-2 border-gray-400 px-4 py-3 text-xl dark:bg-gray-900"
                  />
                </label>
              </div>
            )}
          </section>

          <section className="rounded-xl border-2 border-gray-300 p-6 dark:border-gray-700">
            <h2 className="text-2xl font-semibold">3. Pattern</h2>
            <p className="mt-1 text-base text-gray-600 dark:text-gray-400">
              How the tiles are laid out across the floor.
            </p>
            <label className="mt-4 flex flex-col gap-2 text-lg">
              Pattern
              <select
                value={patternId}
                onChange={(e) => setPatternId(e.target.value)}
                className="rounded-lg border-2 border-gray-400 px-4 py-3 text-xl dark:bg-gray-900"
              >
                {patterns.map((pattern) => (
                  <option key={pattern.id} value={pattern.id}>
                    {pattern.name}
                  </option>
                ))}
              </select>
            </label>
          </section>

          {result && (
            <section className="rounded-xl border-2 border-blue-700 bg-blue-50 p-6 dark:bg-blue-950">
              <h2 className="text-2xl font-semibold">Results</h2>
              <dl className="mt-4 flex flex-col gap-3 text-lg">
                <Result label="Room area" value={`${result.room.areaM2.toFixed(2)} m²`} />
                <Result label="Total tiles laid" value={result.tiling.totalPieces} />
                <Result label="Full, uncut tiles" value={result.tiling.fullTiles} />
                <Result label="Tiles that need cutting" value={result.tiling.cutPieces} />
                <Result
                  label="Cut pieces made from an earlier offcut"
                  value={result.tiling.piecesFromReusedOffcuts}
                />
                <Result label="Packs to buy" value={result.packs.packs} emphasis />
                <Result label="Spare tiles left over" value={result.packs.spareTiles} />
              </dl>
            </section>
          )}
        </div>

        <div className="flex w-full flex-1 flex-col gap-4 lg:sticky lg:top-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold">Preview</h2>
            {result && (
              <div className="flex items-center gap-4 text-base text-gray-700 dark:text-gray-300">
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-sm border-2 border-sky-500 bg-sky-100 dark:border-sky-700 dark:bg-sky-950" />
                  Full tile
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-sm border-2 border-amber-600 bg-amber-200 dark:border-amber-500 dark:bg-amber-900" />
                  Cut tile
                </span>
              </div>
            )}
          </div>

          <div className="flex h-[70vh] min-h-[360px] w-full items-center justify-center rounded-xl border-2 border-gray-300 p-6 dark:border-gray-700">
            {result ? (
              <RoomDiagram
                room={result.room}
                tile={selectedTile}
                pattern={selectedPattern}
                editable={shapeMode === "irregular" && cadEditing}
                onVerticesChange={setVertexOverrides}
              />
            ) : (
              <p className="max-w-xs text-center text-lg text-gray-500 dark:text-gray-400">
                Enter your room and tile sizes to see a preview of the layout.
              </p>
            )}
          </div>

          <p className="text-base text-gray-700 dark:text-gray-300">
            Tiles are placed starting from the top-left corner. More patterns
            (diagonal, brick-bond) are coming soon.
          </p>
        </div>
      </div>
    </div>
  );
}

function Result({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string | number;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-gray-700 dark:text-gray-300">{label}</dt>
      <dd className={emphasis ? "text-2xl font-bold" : "text-xl font-semibold"}>
        {value}
      </dd>
    </div>
  );
}
