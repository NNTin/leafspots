import { useState, useCallback } from 'react';

export interface Stroke {
  id: string;
  points: [number, number][]; // [lat, lng][]
  color: string;
  width: number;
}

interface UseDrawingReturn {
  drawMode: boolean;
  strokes: Stroke[];
  toggleDrawMode: () => void;
  addStroke: (stroke: Stroke) => void;
  undoLastStroke: () => void;
  clearStrokes: () => void;
  setStrokes: (strokes: Stroke[]) => void;
}

export function useDrawing(initialStrokes: Stroke[] = []): UseDrawingReturn {
  const [drawMode, setDrawMode] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>(initialStrokes);

  const toggleDrawMode = useCallback(() => setDrawMode((m) => !m), []);
  const addStroke = useCallback((stroke: Stroke) => setStrokes((prev) => [...prev, stroke]), []);
  const undoLastStroke = useCallback(() => setStrokes((prev) => prev.slice(0, -1)), []);
  const clearStrokes = useCallback(() => setStrokes([]), []);

  return { drawMode, strokes, toggleDrawMode, addStroke, undoLastStroke, clearStrokes, setStrokes };
}
