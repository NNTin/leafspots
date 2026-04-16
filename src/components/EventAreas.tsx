import { useState } from 'react';
import { GeoJSON, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { Geometry } from 'geojson';
import eventAreas from '../data/event-areas.json';

const MIN_ZOOM = 18;

function createLabelIcon(name: string) {
  return L.divIcon({
    className: '',
    html: `<div style="
      background: rgba(255,255,255,0.85);
      border: 1px solid rgba(0,0,0,0.25);
      border-radius: 4px;
      padding: 2px 6px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      pointer-events: none;
      transform: translate(-50%, -50%);
    ">${name}</div>`,
    iconSize: undefined,
    iconAnchor: [0, 0],
  });
}

function EventAreasInner() {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());

  useMapEvents({
    zoomend: (e) => setZoom(e.target.getZoom()),
  });

  if (zoom < MIN_ZOOM) return null;

  return (
    <>
      {eventAreas.map((area) => (
        <GeoJSON
          key={area.place_id}
          data={area.geojson as Geometry}
        />
      ))}
      {eventAreas.map((area) => (
        <Marker
          key={`label-${area.place_id}`}
          position={[parseFloat(area.lat), parseFloat(area.lon)]}
          // icon={createLabelIcon(area.name)}
          interactive={false}
        />
      ))}
    </>
  );
}

export default function EventAreas() {
  return <EventAreasInner />;
}
