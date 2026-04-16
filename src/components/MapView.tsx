import { useEffect } from 'react';
import { MapContainer, TileLayer, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Coordinates } from '../utils/distance';
import { haversineDistance } from '../utils/distance';
import DrawingCanvas from './DrawingCanvas';
import SpotMarker from './SpotMarker';
import EventAreas from './EventAreas';
import type { Stroke } from '../hooks/useDrawing';
import type { CustomPin } from '../hooks/usePins';

interface MapViewProps {
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
  onEditPin?: (id: string) => void;
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
  onEditPin,
}: MapViewProps) {
  return (
    <MapContainer
      center={initialCenter ?? BAVARIA_CENTER}
      zoom={initialZoom ?? DEFAULT_ZOOM}
      maxZoom={21}
      style={{ height: '100%', width: '100%' }}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxNativeZoom={19}
        maxZoom={21}
        detectRetina={true}
      />
      {userLocation && (
        <SpotMarker
          lat={userLocation.lat}
          lng={userLocation.lng}
          name="Your Location"
          color="#1e88e5"
          badgeText="your location"
          description="Distances are measured from this marker."
        />
      )}
      <EventAreas />
      <MapStateTracker onViewChange={onViewChange} />
      <MapSizeInvalidator sidebarOpen={sidebarOpen} />
      <PinPlacementHandler pinMode={pinMode} pinColor={pinColor} onPinAdd={onPinAdd} />
      <MapCursorHandler pinMode={pinMode} />
      {pins.map((pin, index) => {
        const distanceKm =
          userLocation !== null
            ? haversineDistance(userLocation, { lat: pin.lat, lng: pin.lng })
            : undefined;

        return (
          <SpotMarker
            key={pin.id}
            lat={pin.lat}
            lng={pin.lng}
            name={pin.title || `Pin ${index + 1}`}
            color={pin.color}
            badgeText="pin"
            description={pin.description || undefined}
            distanceKm={distanceKm}
            draggable={true}
            onDragEnd={(lat, lng) => onPinMove(pin.id, lat, lng)}
            onEdit={onEditPin ? () => onEditPin(pin.id) : undefined}
          />
        );
      })}
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
