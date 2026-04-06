import { useRef, useState, useEffect, useReducer } from 'react';
import { createPortal } from 'react-dom';
import { useMap, useMapEvents } from 'react-leaflet';
import type { Stroke } from '../hooks/useDrawing';

interface Props {
  strokes: Stroke[];
  drawMode: boolean;
  strokeColor: string;
  strokeWidth: number;
  onStrokeComplete: (stroke: Stroke) => void;
}

export default function DrawingCanvas({
  strokes,
  drawMode,
  strokeColor,
  strokeWidth,
  onStrokeComplete,
}: Props) {
  const map = useMap();
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  const [currentPoints, setCurrentPoints] = useState<[number, number][]>([]);
  const isDrawingRef = useRef(false);
  const currentPointsRef = useRef<[number, number][]>([]);
  // Keep mutable refs for props used inside stable event callbacks
  const strokeColorRef = useRef(strokeColor);
  const strokeWidthRef = useRef(strokeWidth);
  const onStrokeCompleteRef = useRef(onStrokeComplete);

  useEffect(() => { strokeColorRef.current = strokeColor; }, [strokeColor]);
  useEffect(() => { strokeWidthRef.current = strokeWidth; }, [strokeWidth]);
  useEffect(() => { onStrokeCompleteRef.current = onStrokeComplete; }, [onStrokeComplete]);

  // Re-render saved strokes when the map is panned or zoomed
  useMapEvents({
    move: forceUpdate,
    zoom: forceUpdate,
    zoomend: forceUpdate,
    moveend: forceUpdate,
  });

  // Disable map interaction while in draw mode so panning doesn't interfere
  useEffect(() => {
    if (drawMode) {
      map.dragging.disable();
      map.scrollWheelZoom.disable();
      map.doubleClickZoom.disable();
    } else {
      map.dragging.enable();
      map.scrollWheelZoom.enable();
      map.doubleClickZoom.enable();
      // Cancel any in-progress stroke when leaving draw mode (refs only, no setState)
      isDrawingRef.current = false;
      currentPointsRef.current = [];
    }
    return () => {
      map.dragging.enable();
      map.scrollWheelZoom.enable();
      map.doubleClickZoom.enable();
    };
  }, [drawMode, map]);

  function getPoint(clientX: number, clientY: number): [number, number] {
    const rect = map.getContainer().getBoundingClientRect();
    const latlng = map.containerPointToLatLng([clientX - rect.left, clientY - rect.top]);
    return [latlng.lat, latlng.lng];
  }

  function handleMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    if (!drawMode) return;
    e.preventDefault();
    isDrawingRef.current = true;
    const point = getPoint(e.clientX, e.clientY);
    currentPointsRef.current = [point];
    setCurrentPoints([point]);
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!isDrawingRef.current) return;
    const point = getPoint(e.clientX, e.clientY);
    const next = [...currentPointsRef.current, point];
    currentPointsRef.current = next;
    setCurrentPoints(next);
  }

  function finishStroke() {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const pts = currentPointsRef.current;
    if (pts.length > 1) {
      onStrokeCompleteRef.current({
        id: crypto.randomUUID(),
        points: [...pts],
        color: strokeColorRef.current,
        width: strokeWidthRef.current,
      });
    }
    currentPointsRef.current = [];
    setCurrentPoints([]);
  }

  function pointsToPathD(points: [number, number][]): string {
    if (points.length === 0) return '';
    return points
      .map((p, i) => {
        const pt = map.latLngToContainerPoint([p[0], p[1]]);
        return `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`;
      })
      .join(' ');
  }

  const size = map.getSize();

  return createPortal(
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: size.x,
        height: size.y,
        zIndex: 1000,
        pointerEvents: drawMode ? 'all' : 'none',
        cursor: drawMode ? 'crosshair' : 'default',
        touchAction: drawMode ? 'none' : 'auto',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={finishStroke}
      onMouseLeave={finishStroke}
    >
      {strokes.map((stroke) => (
        <path
          key={stroke.id}
          d={pointsToPathD(stroke.points)}
          stroke={stroke.color}
          strokeWidth={stroke.width}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {drawMode && currentPoints.length > 0 && (
        <path
          d={pointsToPathD(currentPoints)}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.7}
        />
      )}
    </svg>,
    map.getContainer(),
  );
}
