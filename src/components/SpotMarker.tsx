import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import MarkerPopupContent from './MarkerPopupContent';

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
  onEdit?: () => void;
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
  onEdit,
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
        <MarkerPopupContent
          title={name}
          lat={lat}
          lng={lng}
          badgeText={badgeText}
          badgeColor={badgeText ? sanitizeColor(color) : undefined}
          description={description}
          distanceKm={distanceKm}
          onEdit={onEdit}
        />
      </Popup>
    </Marker>
  );
}
