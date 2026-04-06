import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Spot } from '../data/spots';
import type { Coordinates } from '../utils/distance';
import { haversineDistance } from '../utils/distance';
import SpotMarker from './SpotMarker';
import DrawingCanvas from './DrawingCanvas';
import type { Stroke } from '../hooks/useDrawing';
import type { CustomPin } from '../hooks/usePins';

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
  pins: CustomPin[];
  pinMode: boolean;
  pinColor: string;
  onPinAdd: (lat: number, lng: number, color: string) => void;
  onPinMove: (id: string, lat: number, lng: number) => void;
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

/** Listens for map clicks and places a new custom pin when in pin mode. */
function PinPlacementHandler({
  pinMode,
  pinColor,
  onPinAdd,
}: {
  pinMode: boolean;
  pinColor: string;
  onPinAdd: (lat: number, lng: number, color: string) => void;
}) {
  useMapEvents({
    click: (e) => {
      if (pinMode) {
        onPinAdd(e.latlng.lat, e.latlng.lng, pinColor);
      }
    },
  });
  return null;
}

/** Changes the map cursor to crosshair when in pin mode. */
function MapCursorHandler({ pinMode }: { pinMode: boolean }) {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    container.style.cursor = pinMode ? 'crosshair' : '';
    return () => { container.style.cursor = ''; };
  }, [pinMode, map]);
  return null;
}

/** A draggable, colored circular marker for a custom pin. */
function PinMarker({ pin, onMove }: { pin: CustomPin; onMove: (id: string, lat: number, lng: number) => void }) {
  const icon = useMemo(
    () =>
      L.divIcon({
        html: `<div style="width:16px;height:16px;border-radius:50%;background:${pin.color};border:2.5px solid rgba(0,0,0,0.45);box-shadow:0 1px 4px rgba(0,0,0,0.35);"></div>`,
        className: '',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
    [pin.color],
  );

  return (
    <Marker
      position={[pin.lat, pin.lng]}
      icon={icon}
      draggable={true}
      eventHandlers={{
        dragend: (e) => {
          const { lat, lng } = (e.target as L.Marker).getLatLng();
          onMove(pin.id, lat, lng);
        },
      }}
    />
  );
}

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
  pins,
  pinMode,
  pinColor,
  onPinAdd,
  onPinMove,
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
      <PinPlacementHandler pinMode={pinMode} pinColor={pinColor} onPinAdd={onPinAdd} />
      <MapCursorHandler pinMode={pinMode} />
      {pins.map((pin) => (
        <PinMarker key={pin.id} pin={pin} onMove={onPinMove} />
      ))}
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
