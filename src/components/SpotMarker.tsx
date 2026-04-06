import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import type { Spot } from '../data/spots';
import { formatDistance } from '../utils/distance';

// Fix default icon URLs broken by Vite's asset bundling
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const categoryColors: Record<string, string> = {
  swimming: '#2196f3',
  hiking: '#4caf50',
  'beer garden': '#ff9800',
  cycling: '#9c27b0',
  skiing: '#00bcd4',
};

function createColoredIcon(category: string) {
  const color = categoryColors[category] ?? '#607d8b';
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 28px;
      height: 28px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      background: ${color};
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -30],
  });
}

interface SpotMarkerProps {
  spot: Spot;
  distanceKm?: number;
}

export default function SpotMarker({ spot, distanceKm }: SpotMarkerProps) {
  const icon = createColoredIcon(spot.category);

  return (
    <Marker position={[spot.lat, spot.lng]} icon={icon}>
      <Popup>
        <div className="spot-popup">
          <h3>{spot.name}</h3>
          <span className="spot-category" style={{ background: categoryColors[spot.category] ?? '#607d8b' }}>
            {spot.category}
          </span>
          {spot.description && <p>{spot.description}</p>}
          {distanceKm !== undefined && (
            <p className="spot-distance">📍 {formatDistance(distanceKm)} away</p>
          )}
        </div>
      </Popup>
    </Marker>
  );
}
