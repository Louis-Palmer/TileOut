"use client";

import { useMemo } from "react";
import type { RoomShape } from "@/lib/shapes/types";
import type { TileSize } from "@/lib/tiles/types";
import type { TilePattern } from "@/lib/patterns/types";

interface RoomDiagramProps {
  room: RoomShape;
  tile: TileSize;
  pattern: TilePattern;
}

// Draws the room to scale and lays the same tile placements the calculator
// used on top of it, so the picture can never disagree with the numbers.
// Dimension labels and margins are all in the room's own millimetre
// coordinate space, so the drawing scales correctly at any container size.
export function RoomDiagram({ room, tile, pattern }: RoomDiagramProps) {
  const { widthMm, lengthMm } = room.boundingBox;
  const placements = useMemo(() => pattern.layout(room, tile), [room, tile, pattern]);

  const marginTop = lengthMm * 0.14;
  const marginLeft = widthMm * 0.14;
  const marginRight = Math.max(widthMm, lengthMm) * 0.05;
  const marginBottom = Math.max(widthMm, lengthMm) * 0.05;

  const viewBoxWidth = widthMm + marginLeft + marginRight;
  const viewBoxHeight = lengthMm + marginTop + marginBottom;
  const fontSize = Math.max(widthMm, lengthMm) * 0.045;
  const strokeWidth = Math.max(widthMm, lengthMm) * 0.003;

  return (
    <svg
      viewBox={`${-marginLeft} ${-marginTop} ${viewBoxWidth} ${viewBoxHeight}`}
      className="h-full w-full"
      role="img"
      aria-label={`Room ${(widthMm / 1000).toFixed(2)} by ${(lengthMm / 1000).toFixed(2)} metres, showing ${placements.length} tiles, ${placements.filter((p) => p.cut).length} of them cut`}
    >
      {placements.map((piece, i) => (
        <rect
          key={i}
          x={piece.x}
          y={piece.y}
          width={piece.width}
          height={piece.height}
          className={
            piece.cut
              ? "fill-amber-200 stroke-amber-600 dark:fill-amber-900 dark:stroke-amber-500"
              : "fill-sky-100 stroke-sky-500 dark:fill-sky-950 dark:stroke-sky-700"
          }
          strokeWidth={strokeWidth}
        />
      ))}

      <rect
        x={0}
        y={0}
        width={widthMm}
        height={lengthMm}
        fill="none"
        className="stroke-gray-900 dark:stroke-gray-100"
        strokeWidth={strokeWidth * 3}
      />

      <text
        x={widthMm / 2}
        y={-marginTop / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={fontSize}
        className="fill-gray-900 font-semibold dark:fill-gray-100"
      >
        {(widthMm / 1000).toFixed(2)} m
      </text>

      <text
        x={-marginLeft / 2}
        y={lengthMm / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={fontSize}
        transform={`rotate(-90 ${-marginLeft / 2} ${lengthMm / 2})`}
        className="fill-gray-900 font-semibold dark:fill-gray-100"
      >
        {(lengthMm / 1000).toFixed(2)} m
      </text>
    </svg>
  );
}
