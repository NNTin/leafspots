import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
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

function sanitizeColor(color: string): string {
  return /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : '#607d8b';
}

function createColoredIcon(color: string) {
  const safeColor = sanitizeColor(color);
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 28px;
      height: 28px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      background: ${safeColor};
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -30],
  });
}

interface SpotMarkerProps {
  lat: number;
  lng: number;
  name: string;
  color: string;
  badgeText?: string;
  description?: string;
  distanceKm?: number;
  draggable?: boolean;
  onDragEnd?: (lat: number, lng: number) => void;
}

export default function SpotMarker({
  lat,
  lng,
  name,
  color,
  badgeText,
  description,
  distanceKm,
  draggable = false,
  onDragEnd,
}: SpotMarkerProps) {
  const icon = createColoredIcon(color);
  const eventHandlers = {
    click: (e: L.LeafletEvent) => {
      (e.target as L.Marker).openPopup();
    },
    ...(draggable && onDragEnd
      ? {
          dragend: (e: L.LeafletEvent) => {
            const { lat: nextLat, lng: nextLng } = (e.target as L.Marker).getLatLng();
            onDragEnd(nextLat, nextLng);
          },
        }
      : {}),
  };

  return (
    <Marker
      position={[lat, lng]}
      icon={icon}
      draggable={draggable}
      eventHandlers={eventHandlers}
    >
      <Popup>
        <div className="spot-popup">
          <h3>{name}</h3>
          {badgeText && (
            <span className="spot-category" style={{ background: sanitizeColor(color) }}>
              {badgeText}
            </span>
          )}
          {description && <p>{description}</p>}
          {distanceKm !== undefined && (
            <p className="spot-distance">📍 {formatDistance(distanceKm)} away</p>
          )}
          <a
            href={`https://www.google.com/maps?q=${lat},${lng}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View on Google Maps
          </a>
        </div>
      </Popup>
    </Marker>
  );
}
