"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import type { RoomShape, Point } from "@/lib/shapes/types";
import type { TileSize } from "@/lib/tiles/types";
import type { TilePattern } from "@/lib/patterns/types";
import { centroidOf, interiorAnglesDeg, isSimplePolygon } from "@/lib/shapes/polygon";

interface RoomDiagramProps {
  room: RoomShape;
  tile: TileSize;
  groutMm: number;
  pattern: TilePattern;
  // When set, draws draggable corner handles and reports edits here
  // instead of drawing a static outline.
  editable?: boolean;
  onVerticesChange?: (vertices: Point[]) => void;
}

const GRID_SNAP_MM = 10;

// The diagram's viewBox auto-fits to the room's current bounding box, so
// dragging a corner outward grows the box, which grows the viewBox, which
// increases how many mm one screen pixel represents — meaning the same
// finger movement maps to a bigger jump next frame. Left unchecked, that's
// a compounding feedback loop: a slow, steady drag can explode from a few
// metres to tens of metres within about a second (verified by simulating
// the exact viewBox/CTM math offline). Capping how far a single drag event
// may move the vertex turns that exponential blowup into steady, bounded
// growth — the drag still tracks the finger closely at normal speeds, it
// just can't runaway.
const MAX_DRAG_STEP_MM = 400;

// `touch-action: none` on the handle alone isn't fully reliable across
// mobile browsers — some let a drag "slip" into the page's native
// scroll/pan gesture after a small amount of movement. The robust,
// cross-browser fix is to freeze the whole page in place for the exact
// duration of the drag (finger down to finger up), rather than trying to
// scope the prevention to just the handle. Fixing the body's position
// (rather than only `overflow: hidden`, which iOS Safari doesn't reliably
// honour for touch scrolling) is the standard trick — it has to save and
// restore the scroll position itself, since a fixed-position body has no
// scroll position of its own.
//
// This also has to suppress text selection, which is a separate native
// gesture `touch-action` has no effect on at all. A finger moving during a
// drag can end up over ordinary text on the page (e.g. the caption below
// the diagram), and the browser's own gesture recognition can decide that
// looks like a text-selection drag — visibly highlighting text, and on
// several mobile browsers, cancelling the in-progress pointer sequence
// (firing `pointercancel`) to hand the gesture over to native selection.
// That's what a drag "working for a moment, then stopping, then scrolling"
// actually is: the cancelled pointer sequence ends the custom drag (and
// its scroll lock) partway through, and the same ongoing finger motion
// continues as an unintercepted native scroll for the rest of the gesture.
function lockPageInteractions(): () => void {
  const scrollY = window.scrollY;
  const { body } = document;
  const previous = {
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    userSelect: body.style.userSelect,
    webkitUserSelect: body.style.getPropertyValue("-webkit-user-select"),
    webkitTouchCallout: body.style.getPropertyValue("-webkit-touch-callout"),
  };
  body.style.position = "fixed";
  body.style.top = `-${scrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  body.style.userSelect = "none";
  body.style.setProperty("-webkit-user-select", "none");
  body.style.setProperty("-webkit-touch-callout", "none"); // stops iOS's long-press copy/save menu too

  return () => {
    body.style.position = previous.position;
    body.style.top = previous.top;
    body.style.left = previous.left;
    body.style.right = previous.right;
    body.style.width = previous.width;
    body.style.userSelect = previous.userSelect;
    body.style.setProperty("-webkit-user-select", previous.webkitUserSelect);
    body.style.setProperty("-webkit-touch-callout", previous.webkitTouchCallout);
    window.scrollTo(0, scrollY);
  };
}

// Apple/Google's minimum recommended touch target diameter. Corner handles
// are sized from the diagram's actual on-screen pixels (not the room's own
// millimetre scale) so they hit this size on any device — a room's mm
// scale bears no relationship to how many CSS pixels it renders at, so a
// handle sized as "2% of the room's extent" is tiny on a large room shown
// on a small phone screen, and oversized on a small room on a big monitor.
const TOUCH_TARGET_PX = 44;

// Draws the room to scale and lays the same tile placements the calculator
// used on top of it, so the picture can never disagree with the numbers.
// Every wall gets its own length label and every corner its own angle
// label — computed directly from the vertices, so this works the same for
// a rectangle, a hand-walked pentagon, or a CAD-dragged shape, with no
// special-casing. Margins and label sizes are all in the room's own
// millimetre coordinate space, so the drawing scales correctly at any
// container size.
export function RoomDiagram({ room, tile, groutMm, pattern, editable, onVerticesChange }: RoomDiagramProps) {
  const { widthMm, lengthMm } = room.boundingBox;
  const placements = useMemo(() => pattern.layout(room, tile, groutMm), [room, tile, groutMm, pattern]);
  const centroid = useMemo(() => centroidOf(room.vertices), [room.vertices]);
  const interiorAngles = useMemo(() => interiorAnglesDeg(room.vertices), [room.vertices]);

  const svgRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pixelsPerMm, setPixelsPerMm] = useState<number | null>(null);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const unlockPageRef = useRef<(() => void) | null>(null);

  // Which corner is being dragged, and (for a touch drag) which specific
  // finger — a ref, not state, because the native touch listener below is
  // attached once and can't rely on React re-rendering to hand it a fresh
  // closure the way an inline JSX pointer handler gets one automatically.
  // `touchId: null` means a mouse drag (only one can ever be active).
  const dragRef = useRef<{ index: number; touchId: number | null } | null>(null);

  // Read via this on every use inside the native touch listener, for the
  // same reason: `room`/`onVerticesChange` must always be the latest
  // values, not whatever they were when the listener was first attached.
  // Updated in an effect (not directly in the render body) since mutating a
  // ref during render is disallowed.
  const latestRef = useRef({ room, onVerticesChange });
  useEffect(() => {
    latestRef.current = { room, onVerticesChange };
  });

  // Safety net: if this component unmounts mid-drag (e.g. navigating away
  // with a finger still down), don't leave the page permanently frozen.
  useEffect(() => {
    return () => {
      unlockPageRef.current?.();
      unlockPageRef.current = null;
    };
  }, []);

  // "Coarse pointer" (touch) vs "fine pointer" (mouse/trackpad) is the
  // right thing to key handle size off — screen width alone would also
  // catch a narrow desktop window, and device type alone wouldn't catch a
  // touchscreen laptop. Only touch devices need the enlarged touch target;
  // a mouse can hit the smaller, room-scale-relative handle just fine, and
  // it looks better proportioned there than an oversized fixed circle.
  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse)");
    const update = () => setIsCoarsePointer(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const maxExtent = Math.max(widthMm, lengthMm);
  const margin = maxExtent * 0.13;
  const viewBoxWidth = widthMm + margin * 2;
  const viewBoxHeight = lengthMm + margin * 2;
  const fontSize = maxExtent * 0.04;
  const angleFontSize = fontSize * 0.8;
  const strokeWidth = maxExtent * 0.003;
  const edgeLabelOffset = margin * 0.45;
  const angleLabelOffset = margin * 0.35;

  // Measure how many CSS pixels one room-millimetre actually renders as,
  // matching the same "meet" scaling the viewBox itself uses (the smaller
  // of the width/height ratios, since that's whichever dimension is
  // letterboxed). Re-measures on resize/orientation change/layout shifts.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const updateScale = () => {
      const rect = svg.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setPixelsPerMm(Math.min(rect.width / viewBoxWidth, rect.height / viewBoxHeight));
      }
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [viewBoxWidth, viewBoxHeight]);

  // On a mouse, the smaller room-scale-relative size looks better
  // proportioned and is plenty easy to click precisely. On touch, size
  // from the diagram's actual on-screen pixels instead (a room's mm scale
  // bears no relationship to how many CSS pixels it renders at, so "2% of
  // the room's extent" is tiny on a large room shown on a small phone
  // screen) — falling back to the relative guess before the first
  // measurement lands so handles aren't invisible for a frame.
  const handleRadius =
    isCoarsePointer && pixelsPerMm ? TOUCH_TARGET_PX / 2 / pixelsPerMm : maxExtent * 0.02;
  const handleStrokeWidth = isCoarsePointer && pixelsPerMm ? 3 / pixelsPerMm : strokeWidth * 2;

  const toRoomPoint = useCallback((clientX: number, clientY: number): Point | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const transformed = point.matrixTransform(ctm.inverse());
    return { x: transformed.x, y: transformed.y };
  }, []);

  // Shared by both input paths below (mouse-via-React-pointer-events, and
  // touch-via-native-listeners): convert a screen point to a room
  // coordinate, snap it, validate the resulting shape stays simple, and
  // commit it. This is the one place drag *behaviour* lives — the two
  // input paths only differ in how they capture clientX/clientY and figure
  // out which corner is being touched, never in what happens once they
  // have that.
  // Stable identities (empty dep arrays) so the native touch effect below
  // can legitimately list them as dependencies without needing to
  // re-attach its listeners on every render — they only ever read current
  // values via refs, never via closed-over props/state.
  const applyDragPosition = useCallback((index: number, clientX: number, clientY: number) => {
    const { room, onVerticesChange } = latestRef.current;
    if (!onVerticesChange) return;
    const raw = toRoomPoint(clientX, clientY);
    if (!raw) return;
    const current = room.vertices[index];
    const dx = raw.x - current.x;
    const dy = raw.y - current.y;
    const dist = Math.hypot(dx, dy);
    const target =
      dist > MAX_DRAG_STEP_MM
        ? { x: current.x + (dx / dist) * MAX_DRAG_STEP_MM, y: current.y + (dy / dist) * MAX_DRAG_STEP_MM }
        : raw;
    const snapped = {
      x: Math.round(target.x / GRID_SNAP_MM) * GRID_SNAP_MM,
      y: Math.round(target.y / GRID_SNAP_MM) * GRID_SNAP_MM,
    };
    const candidate = room.vertices.map((v, i) => (i === index ? snapped : v));
    if (isSimplePolygon(candidate)) onVerticesChange(candidate);
  }, [toRoomPoint]);

  const beginDrag = useCallback((index: number, touchId: number | null) => {
    dragRef.current = { index, touchId };
    setIsDragging(true);
    if (!unlockPageRef.current) {
      unlockPageRef.current = lockPageInteractions();
    }
  }, []);

  const endDrag = useCallback(() => {
    dragRef.current = null;
    setIsDragging(false);
    unlockPageRef.current?.();
    unlockPageRef.current = null;
  }, []);

  // Mouse/pen path, via React's normal synthetic pointer events — this
  // continues to work exactly as before. Touch input is deliberately
  // excluded here (see the native listeners below) and handled there
  // instead: a touch fires both a native `touchstart` and a synthesized
  // `pointerdown` with pointerType "touch", so without this guard the same
  // physical touch would be processed twice.
  function handlePointerDown(event: PointerEvent<SVGCircleElement>, index: number) {
    if (event.pointerType === "touch") return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    beginDrag(index, null);
  }

  function handlePointerMove(event: PointerEvent<SVGCircleElement>) {
    if (event.pointerType === "touch") return;
    const tracking = dragRef.current;
    if (!tracking || tracking.touchId !== null) return;
    event.preventDefault();
    applyDragPosition(tracking.index, event.clientX, event.clientY);
  }

  function handlePointerUp(event: PointerEvent<SVGCircleElement>) {
    if (event.pointerType === "touch") return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    endDrag();
  }

  // Touch path: native, explicitly non-passive listeners, bypassing
  // React's synthetic event system entirely. This is the actual fix for
  // the drag getting hijacked by the browser's native scroll/selection
  // gesture partway through — `{ passive: false }` is what makes
  // `preventDefault()` here binding on the browser's own gesture
  // arbitration, which is not something reliably guaranteed when going
  // through React's synthetic pointer events for touch input. Touch event
  // targeting is "sticky" to whatever element `touchstart` fired on for
  // the rest of that touch's lifetime (unlike mouse events), so attaching
  // all four listeners to the SVG itself is enough — no need to also
  // listen on `window` for the finger moving outside the element.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !editable || !onVerticesChange) return;

    function vertexIndexFromTarget(target: EventTarget | null): number | null {
      if (!(target instanceof Element)) return null;
      const handle = target.closest("[data-vertex-index]");
      if (!handle) return null;
      const raw = handle.getAttribute("data-vertex-index");
      return raw === null ? null : Number(raw);
    }

    function onTouchStart(event: TouchEvent) {
      if (dragRef.current) return; // already tracking a finger
      const touch = event.changedTouches[0];
      const index = vertexIndexFromTarget(touch.target);
      if (index === null) return;
      event.preventDefault();
      beginDrag(index, touch.identifier);
    }

    function onTouchMove(event: TouchEvent) {
      const tracking = dragRef.current;
      if (!tracking || tracking.touchId === null) return;
      const touch = Array.from(event.changedTouches).find((t) => t.identifier === tracking.touchId);
      if (!touch) return;
      event.preventDefault();
      applyDragPosition(tracking.index, touch.clientX, touch.clientY);
    }

    function onTouchEnd(event: TouchEvent) {
      const tracking = dragRef.current;
      if (!tracking || tracking.touchId === null) return;
      const stillTracked = Array.from(event.changedTouches).some((t) => t.identifier === tracking.touchId);
      if (!stillTracked) return;
      endDrag();
    }

    svg.addEventListener("touchstart", onTouchStart, { passive: false });
    svg.addEventListener("touchmove", onTouchMove, { passive: false });
    svg.addEventListener("touchend", onTouchEnd, { passive: false });
    svg.addEventListener("touchcancel", onTouchEnd, { passive: false });
    return () => {
      svg.removeEventListener("touchstart", onTouchStart);
      svg.removeEventListener("touchmove", onTouchMove);
      svg.removeEventListener("touchend", onTouchEnd);
      svg.removeEventListener("touchcancel", onTouchEnd);
    };
    // `applyDragPosition`/`beginDrag`/`endDrag` are stable (useCallback with
    // empty deps) so listing them here doesn't cause a re-attach on every
    // `room` change — they always read current data via latestRef instead.
  }, [editable, onVerticesChange, applyDragPosition, beginDrag, endDrag]);

  const cutCount = placements.filter((p) => p.cut).length;

  return (
    <svg
      ref={svgRef}
      viewBox={`${-margin} ${-margin} ${viewBoxWidth} ${viewBoxHeight}`}
      className={`h-full w-full ${isDragging ? "touch-none" : ""}`}
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
            data-vertex-index={i}
            cx={v.x}
            cy={v.y}
            r={handleRadius}
            className="cursor-move touch-none fill-blue-600 stroke-white dark:fill-blue-400 dark:stroke-gray-900"
            strokeWidth={handleStrokeWidth}
            onPointerDown={(e) => handlePointerDown(e, i)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
        ))}
    </svg>
  );
}
