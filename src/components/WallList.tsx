"use client";

import type { WallInput } from "@/lib/shapes/walk";

interface WallListProps {
  walls: WallInput[];
  onChange: (walls: WallInput[]) => void;
  closureErrorMm: number;
}

const MIN_WALLS = 3;
const CLOSES_TOLERANCE_MM = 50;

// A growing list of wall rows (length + corner angle), matching the app's
// existing row-based form style rather than a separate wizard. The room
// diagram updates live from this list — there's no submit step.
export function WallList({ walls, onChange, closureErrorMm }: WallListProps) {
  const updateWall = (index: number, patch: Partial<WallInput>) => {
    onChange(walls.map((wall, i) => (i === index ? { ...wall, ...patch } : wall)));
  };

  const addWall = () => {
    const last = walls[walls.length - 1];
    onChange([...walls, { lengthMm: last?.lengthMm ?? 1000, interiorAngleDeg: 90 }]);
  };

  const removeWall = (index: number) => {
    if (walls.length <= MIN_WALLS) return;
    onChange(walls.filter((_, i) => i !== index));
  };

  const closes = closureErrorMm < CLOSES_TOLERANCE_MM;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {walls.map((wall, i) => (
          <div
            key={i}
            className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-300 p-3 dark:border-gray-700"
          >
            <span className="pb-2 text-base font-semibold text-gray-500 dark:text-gray-400">
              Wall {i + 1}
            </span>
            <label className="flex flex-1 min-w-[100px] flex-col gap-1 text-base">
              Length (m)
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={wall.lengthMm / 1000}
                onChange={(e) => updateWall(i, { lengthMm: (Number(e.target.value) || 0) * 1000 })}
                className="rounded-lg border-2 border-gray-400 px-3 py-2 text-lg dark:bg-gray-900"
              />
            </label>
            <label className="flex flex-1 min-w-[100px] flex-col gap-1 text-base">
              Corner angle (°)
              <input
                type="number"
                inputMode="decimal"
                min="1"
                max="359"
                value={wall.interiorAngleDeg}
                onChange={(e) => updateWall(i, { interiorAngleDeg: Number(e.target.value) || 90 })}
                className="rounded-lg border-2 border-gray-400 px-3 py-2 text-lg dark:bg-gray-900"
              />
            </label>
            <button
              type="button"
              onClick={() => removeWall(i)}
              disabled={walls.length <= MIN_WALLS}
              className="rounded-lg border-2 border-gray-400 px-3 py-2 text-base text-gray-600 disabled:opacity-40 dark:text-gray-300"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addWall}
        className="rounded-lg border-2 border-dashed border-gray-400 px-4 py-3 text-lg font-semibold text-gray-700 hover:border-gray-600 dark:text-gray-300"
      >
        + Add wall
      </button>

      <p
        className={
          closes
            ? "text-base font-semibold text-green-700 dark:text-green-400"
            : "text-base font-semibold text-amber-700 dark:text-amber-400"
        }
      >
        {closes
          ? "Shape closes"
          : `Off by ${(closureErrorMm / 1000).toFixed(2)} m — check a wall length or corner angle`}
      </p>
    </div>
  );
}
