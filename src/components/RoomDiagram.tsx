"use client";

import { useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import type { RoomShape, Point } from "@/lib/shapes/types";
import type { TileSize } from "@/lib/tiles/types";
import type { TilePattern } from "@/lib/patterns/types";
import { isSimplePolygon } from "@/lib/shapes/polygon";

interface RoomDiagramProps {
  room: RoomShape;
  tile: TileSize;
  pattern: TilePattern;
  // When set, draws draggable corner handles and reports edits here
  // instead of drawing a static outline.
  editable?: boolean;
  onVerticesChange?: (vertices: Point[]) => void;
}

const GRID_SNAP_MM = 10;

// Draws the room to scale and lays the same tile placements the calculator
// used on top of it, so the picture can never disagree with the numbers.
// Dimension labels and margins are all in the room's own millimetre
// coordinate space, so the drawing scales correctly at any container size.
export function RoomDiagram({ room, tile, pattern, editable, onVerticesChange }: RoomDiagramProps) {
  const { widthMm, lengthMm } = room.boundingBox;
  const placements = useMemo(() => pattern.layout(room, tile), [room, tile, pattern]);

  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const marginTop = lengthMm * 0.14;
  const marginLeft = widthMm * 0.14;
  const marginRight = Math.max(widthMm, lengthMm) * 0.05;
  const marginBottom = Math.max(widthMm, lengthMm) * 0.05;

  const viewBoxWidth = widthMm + marginLeft + marginRight;
  const viewBoxHeight = lengthMm + marginTop + marginBottom;
  const fontSize = Math.max(widthMm, lengthMm) * 0.045;
  const strokeWidth = Math.max(widthMm, lengthMm) * 0.003;
  const handleRadius = Math.max(widthMm, lengthMm) * 0.02;

  function toRoomPoint(clientX: number, clientY: number): Point | null {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const transformed = point.matrixTransform(ctm.inverse());
    return { x: transformed.x, y: transformed.y };
  }

  function handlePointerDown(event: PointerEvent<SVGCircleElement>, index: number) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingIndex(index);
  }

  function handlePointerMove(event: PointerEvent<SVGCircleElement>) {
    if (draggingIndex === null || !onVerticesChange) return;
    const raw = toRoomPoint(event.clientX, event.clientY);
    if (!raw) return;
    const snapped = {
      x: Math.round(raw.x / GRID_SNAP_MM) * GRID_SNAP_MM,
      y: Math.round(raw.y / GRID_SNAP_MM) * GRID_SNAP_MM,
    };
    const candidate = room.vertices.map((v, i) => (i === draggingIndex ? snapped : v));
    if (isSimplePolygon(candidate)) onVerticesChange(candidate);
  }

  function handlePointerUp(event: PointerEvent<SVGCircleElement>) {
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDraggingIndex(null);
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`${-marginLeft} ${-marginTop} ${viewBoxWidth} ${viewBoxHeight}`}
      className="h-full w-full"
      role="img"
      aria-label={`Room ${(widthMm / 1000).toFixed(2)} by ${(lengthMm / 1000).toFixed(2)} metres, showing ${placements.length} tiles, ${placements.filter((p) => p.cut).length} of them cut`}
    >
      {placements.map((piece, i) => {
        const className = piece.cut
          ? "fill-amber-200 stroke-amber-600 dark:fill-amber-900 dark:stroke-amber-500"
          : "fill-sky-100 stroke-sky-500 dark:fill-sky-950 dark:stroke-sky-700";

        // A room boundary that isn't a plain rectangle can carve a
        // non-rectangular notch into an edge piece — draw its true shape
        // (one <polygon> per convex sub-piece; they share exact edges with
        // no gaps, so together they read as one seamless piece).
        if (piece.shape) {
          return (
            <g key={i}>
              {piece.shape.map((polygon, j) => (
                <polygon
                  key={j}
                  points={polygon.map((v) => `${v.x},${v.y}`).join(" ")}
                  className={className}
                  strokeWidth={strokeWidth}
                />
              ))}
            </g>
          );
        }

        return (
          <rect
            key={i}
            x={piece.x}
            y={piece.y}
            width={piece.width}
            height={piece.height}
            className={className}
            strokeWidth={strokeWidth}
          />
        );
      })}

      <polygon
        points={room.vertices.map((v) => `${v.x},${v.y}`).join(" ")}
        fill="none"
        className="stroke-gray-900 dark:stroke-gray-100"
        strokeWidth={strokeWidth * 3}
      />

      {editable &&
        onVerticesChange &&
        room.vertices.map((v, i) => (
          <circle
            key={i}
            cx={v.x}
            cy={v.y}
            r={handleRadius}
            className="cursor-move fill-blue-600 stroke-white dark:fill-blue-400 dark:stroke-gray-900"
            strokeWidth={strokeWidth * 2}
            onPointerDown={(e) => handlePointerDown(e, i)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
        ))}

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
