import { useState, useCallback } from 'react';

export interface CustomPin {
  id: string;
  lat: number;
  lng: number;
  color: string;
  title: string;
  description: string;
}

interface UsePinsReturn {
  pins: CustomPin[];
  addPin: (lat: number, lng: number, color: string) => void;
  movePin: (id: string, lat: number, lng: number) => void;
  updatePin: (id: string, updates: Partial<Omit<CustomPin, 'id'>>) => void;
  clearPins: () => void;
  setPins: (pins: CustomPin[]) => void;
}

export function usePins(initialPins: CustomPin[] | (() => CustomPin[]) = []): UsePinsReturn {
  const [pins, setPins] = useState<CustomPin[]>(initialPins);

  const addPin = useCallback((lat: number, lng: number, color: string) => {
    setPins((prev) => [...prev, { id: crypto.randomUUID(), lat, lng, color, title: '', description: '' }]);
  }, []);

  const movePin = useCallback((id: string, lat: number, lng: number) => {
    setPins((prev) => prev.map((p) => (p.id === id ? { ...p, lat, lng } : p)));
  }, []);

  const updatePin = useCallback((id: string, updates: Partial<Omit<CustomPin, 'id'>>) => {
    setPins((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  }, []);

  const clearPins = useCallback(() => setPins([]), []);

  return { pins, addPin, movePin, updatePin, clearPins, setPins };
}
