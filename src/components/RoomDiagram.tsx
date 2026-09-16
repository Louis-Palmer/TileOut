"use client";

import { useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import type { RoomShape, Point } from "@/lib/shapes/types";
import type { TileSize } from "@/lib/tiles/types";
import type { TilePattern } from "@/lib/patterns/types";
import { interiorAnglesDeg, isSimplePolygon } from "@/lib/shapes/polygon";

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

function centroidOf(vertices: Point[]): Point {
  const sum = vertices.reduce((acc, v) => ({ x: acc.x + v.x, y: acc.y + v.y }), { x: 0, y: 0 });
  return { x: sum.x / vertices.length, y: sum.y / vertices.length };
}

// Draws the room to scale and lays the same tile placements the calculator
// used on top of it, so the picture can never disagree with the numbers.
// Every wall gets its own length label and every corner its own angle
// label — computed directly from the vertices, so this works the same for
// a rectangle, a hand-walked pentagon, or a CAD-dragged shape, with no
// special-casing. Margins and label sizes are all in the room's own
// millimetre coordinate space, so the drawing scales correctly at any
// container size.
export function RoomDiagram({ room, tile, pattern, editable, onVerticesChange }: RoomDiagramProps) {
  const { widthMm, lengthMm } = room.boundingBox;
  const placements = useMemo(() => pattern.layout(room, tile), [room, tile, pattern]);
  const centroid = useMemo(() => centroidOf(room.vertices), [room.vertices]);
  const interiorAngles = useMemo(() => interiorAnglesDeg(room.vertices), [room.vertices]);

  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const maxExtent = Math.max(widthMm, lengthMm);
  const margin = maxExtent * 0.13;
  const viewBoxWidth = widthMm + margin * 2;
  const viewBoxHeight = lengthMm + margin * 2;
  const fontSize = maxExtent * 0.04;
  const angleFontSize = fontSize * 0.8;
  const strokeWidth = maxExtent * 0.003;
  const handleRadius = maxExtent * 0.02;
  const edgeLabelOffset = margin * 0.45;
  const angleLabelOffset = margin * 0.35;

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

  const cutCount = placements.filter((p) => p.cut).length;

  return (
    <svg
      ref={svgRef}
      viewBox={`${-margin} ${-margin} ${viewBoxWidth} ${viewBoxHeight}`}
      className="h-full w-full"
      role="img"
      aria-label={`Room with ${room.vertices.length} corners, showing ${placements.length} tiles, ${cutCount} of them cut`}
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

      {room.vertices.map((v, i) => {
        const next = room.vertices[(i + 1) % room.vertices.length];
        const midX = (v.x + next.x) / 2;
        const midY = (v.y + next.y) / 2;
        const dx = next.x - v.x;
        const dy = next.y - v.y;
        const edgeLengthMm = Math.hypot(dx, dy);
        const len = edgeLengthMm || 1;

        // Perpendicular to the edge, then flipped to point away from the
        // room's centroid so the label sits outside the shape.
        let nx = -dy / len;
        let ny = dx / len;
        const pointsOutward = nx * (midX - centroid.x) + ny * (midY - centroid.y) >= 0;
        if (!pointsOutward) {
          nx = -nx;
          ny = -ny;
        }

        return (
          <text
            key={`edge-${i}`}
            x={midX + nx * edgeLabelOffset}
            y={midY + ny * edgeLabelOffset}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={fontSize}
            className="fill-gray-900 font-semibold dark:fill-gray-100"
          >
            {(edgeLengthMm / 1000).toFixed(2)} m
          </text>
        );
      })}

      {room.vertices.map((v, i) => {
        const towardCentroidX = centroid.x - v.x;
        const towardCentroidY = centroid.y - v.y;
        const dist = Math.hypot(towardCentroidX, towardCentroidY) || 1;
        const labelX = v.x + (towardCentroidX / dist) * angleLabelOffset;
        const labelY = v.y + (towardCentroidY / dist) * angleLabelOffset;

        return (
          <text
            key={`angle-${i}`}
            x={labelX}
            y={labelY}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={angleFontSize}
            className="fill-blue-700 font-medium dark:fill-blue-300"
          >
            {Math.round(interiorAngles[i])}°
          </text>
        );
      })}

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
    </svg>
  );
}
