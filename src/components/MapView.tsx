import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Spot } from '../data/spots';
import type { Coordinates } from '../utils/distance';
import { haversineDistance } from '../utils/distance';
import SpotMarker from './SpotMarker';
import DrawingCanvas from './DrawingCanvas';
import type { Stroke } from '../hooks/useDrawing';

interface MapViewProps {
  spots: Spot[];
  userLocation: Coordinates | null;
  initialCenter?: [number, number];
  initialZoom?: number;
  strokes: Stroke[];
  drawMode: boolean;
  strokeColor: string;
  strokeWidth: number;
  onStrokeComplete: (stroke: Stroke) => void;
  onViewChange: (center: [number, number], zoom: number) => void;
  sidebarOpen: boolean;
}

// Bavaria center
const BAVARIA_CENTER: [number, number] = [48.79, 11.5];
const DEFAULT_ZOOM = 8;

function MapStateTracker({
  onViewChange,
}: {
  onViewChange: (center: [number, number], zoom: number) => void;
}) {
  useMapEvents({
    moveend: (e) => {
      const c = e.target.getCenter();
      onViewChange([c.lat, c.lng], e.target.getZoom());
    },
    zoomend: (e) => {
      const c = e.target.getCenter();
      onViewChange([c.lat, c.lng], e.target.getZoom());
    },
  });
  return null;
}

// Radius (px) of the user-location pin circle marker
const PIN_RADIUS = 10;

/** Calls invalidateSize whenever sidebarOpen toggles so Leaflet reflows correctly. */
function MapSizeInvalidator({ sidebarOpen }: { sidebarOpen: boolean }) {
  const map = useMap();
  useEffect(() => {
    // Delay lets CSS transitions finish before reflowing
    const id = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(id);
  }, [sidebarOpen, map]);
  return null;
}

export default function MapView({
  spots,
  userLocation,
  initialCenter,
  initialZoom,
  strokes,
  drawMode,
  strokeColor,
  strokeWidth,
  onStrokeComplete,
  onViewChange,
  sidebarOpen,
}: MapViewProps) {
  return (
    <MapContainer
      center={initialCenter ?? BAVARIA_CENTER}
      zoom={initialZoom ?? DEFAULT_ZOOM}
      style={{ height: '100%', width: '100%' }}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {spots.map((spot) => {
        const distanceKm =
          userLocation !== null
            ? haversineDistance(userLocation, { lat: spot.lat, lng: spot.lng })
            : undefined;
        return <SpotMarker key={spot.id} spot={spot} distanceKm={distanceKm} />;
      })}
      {userLocation && (
        <CircleMarker
          center={[userLocation.lat, userLocation.lng]}
          radius={PIN_RADIUS}
          pathOptions={{ color: '#1565c0', fillColor: '#1e88e5', fillOpacity: 0.9, weight: 2 }}
        />
      )}
      <MapStateTracker onViewChange={onViewChange} />
      <MapSizeInvalidator sidebarOpen={sidebarOpen} />
      <DrawingCanvas
        strokes={strokes}
        drawMode={drawMode}
        strokeColor={strokeColor}
        strokeWidth={strokeWidth}
        onStrokeComplete={onStrokeComplete}
      />
    </MapContainer>
  );
}
