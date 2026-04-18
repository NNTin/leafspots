import { forwardRef, useEffect } from 'react';
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
  layoutInvalidationKey?: string;
  pins: CustomPin[];
  pinMode: boolean;
  pinColor: string;
  onPinAdd: (lat: number, lng: number, color: string) => void;
  onPinMove: (id: string, lat: number, lng: number) => void;
  onEditPin?: (id: string) => void;
  eventAreaMarkerOverrides?: Record<number, { title: string; description: string }>;
  onEditAreaMarker?: (placeId: number, title: string, description: string) => void;
}

// Bavaria center
const BAVARIA_CENTER: [number, number] = [48.79, 11.5];
const DEFAULT_ZOOM = 8;
const MAP_MAX_ZOOM = 21;
const TILE_MAX_NATIVE_ZOOM = 19;
const TILE_LAYER_MAX_ZOOM = MAP_MAX_ZOOM + 1;

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

/** Calls invalidateSize whenever the map layout changes so Leaflet reflows correctly. */
function MapSizeInvalidator({ layoutInvalidationKey }: { layoutInvalidationKey: string }) {
  const map = useMap();
  useEffect(() => {
    // Delay lets CSS transitions finish before reflowing
    const id = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(id);
  }, [layoutInvalidationKey, map]);
  return null;
}

const MapView = forwardRef<HTMLDivElement, MapViewProps>(function MapView({
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
  layoutInvalidationKey = 'default',
  pins,
  pinMode,
  pinColor,
  onPinAdd,
  onPinMove,
  onEditPin,
  eventAreaMarkerOverrides = {},
  onEditAreaMarker,
}: MapViewProps, ref) {
  return (
    <div ref={ref} className="map-view">
      <MapContainer
        center={initialCenter ?? BAVARIA_CENTER}
        zoom={initialZoom ?? DEFAULT_ZOOM}
        maxZoom={MAP_MAX_ZOOM}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxNativeZoom={TILE_MAX_NATIVE_ZOOM}
          // Leaflet's retina mode internally asks for one more zoom level.
          // Without this extra headroom, mobile retina devices can hit the
          // map max zoom and end up with blank tiles.
          maxZoom={TILE_LAYER_MAX_ZOOM}
          detectRetina={true}
          crossOrigin={true}
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
        <EventAreas
          markerOverrides={eventAreaMarkerOverrides}
          onEditMarker={onEditAreaMarker}
        />
        <MapStateTracker onViewChange={onViewChange} />
        <MapSizeInvalidator layoutInvalidationKey={`${sidebarOpen ? 'open' : 'closed'}:${layoutInvalidationKey}`} />
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
    </div>
  );
});

export default MapView;
