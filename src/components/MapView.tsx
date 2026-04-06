import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Spot } from '../data/spots';
import type { Coordinates } from '../utils/distance';
import { haversineDistance } from '../utils/distance';
import SpotMarker from './SpotMarker';

interface MapViewProps {
  spots: Spot[];
  userLocation: Coordinates | null;
}

// Bavaria center
const BAVARIA_CENTER: [number, number] = [48.79, 11.5];
const DEFAULT_ZOOM = 8;

export default function MapView({ spots, userLocation }: MapViewProps) {
  return (
    <MapContainer
      center={BAVARIA_CENTER}
      zoom={DEFAULT_ZOOM}
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
    </MapContainer>
  );
}
