import { useState } from 'react';
import { GeoJSON, Marker, SVGOverlay, useMap, useMapEvents } from 'react-leaflet';
// import L from 'leaflet';
import type { Geometry, Position } from 'geojson';
import eventAreasData from '../data/event-areas.json';
import shapesData from '../data/shapes.json';

const MIN_ZOOM = 18;
const SHAPES_MIN_ZOOM = 19;
const SHAPES_REFERENCE_SIZE = { width: 1718, height: 906 };
const SHAPES_AREA_REFERENCE_BBOX = {
  minX: 140,
  maxX: 1656,
  minY: 125,
  maxY: 735,
};

interface EventArea {
  place_id: number;
  lat: string;
  lon: string;
  geojson: Geometry;
}

interface ShapeLine {
  type: 'line';
  points: [number, number, number, number];
  color: string;
  strokeWidth: number;
}

interface ShapeRectangle {
  type: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string;
  strokeWidth: number;
}

type Shape = ShapeLine | ShapeRectangle;

const eventAreas = eventAreasData as EventArea[];
const shapes = shapesData as Shape[];

function getGeometryPositions(geometry: Geometry): Position[] {
  switch (geometry.type) {
    case 'Polygon':
      return geometry.coordinates.flat();
    case 'MultiPolygon':
      return geometry.coordinates.flat(2);
    default:
      return [];
  }
}

function getShapesOverlayBounds(): [[number, number], [number, number]] {
  let minLng = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  for (const area of eventAreas) {
    for (const [lng, lat] of getGeometryPositions(area.geojson)) {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
  }

  // `shapes.json` is authored in the same pixel space as `image.png`.
  // These reference-box measurements were taken from that image against the
  // union of the event area polygons, so the shapes can be stretched into map
  // coordinates without changing the GeoJSON data.
  const bboxWidth = SHAPES_AREA_REFERENCE_BBOX.maxX - SHAPES_AREA_REFERENCE_BBOX.minX;
  const bboxHeight = SHAPES_AREA_REFERENCE_BBOX.maxY - SHAPES_AREA_REFERENCE_BBOX.minY;
  const lngSpan = maxLng - minLng;
  const latSpan = maxLat - minLat;

  const west = minLng - (SHAPES_AREA_REFERENCE_BBOX.minX / bboxWidth) * lngSpan;
  const east =
    minLng +
    ((SHAPES_REFERENCE_SIZE.width - SHAPES_AREA_REFERENCE_BBOX.minX) / bboxWidth) * lngSpan;
  const north = maxLat + (SHAPES_AREA_REFERENCE_BBOX.minY / bboxHeight) * latSpan;
  const south =
    maxLat -
    ((SHAPES_REFERENCE_SIZE.height - SHAPES_AREA_REFERENCE_BBOX.minY) / bboxHeight) * latSpan;

  return [[south, west], [north, east]];
}

const SHAPES_OVERLAY_BOUNDS = getShapesOverlayBounds();

// function createLabelIcon(name: string) {
//   return L.divIcon({
//     className: '',
//     html: `<div style="
//       background: rgba(255,255,255,0.85);
//       border: 1px solid rgba(0,0,0,0.25);
//       border-radius: 4px;
//       padding: 2px 6px;
//       font-size: 12px;
//       font-weight: 600;
//       white-space: nowrap;
//       pointer-events: none;
//       transform: translate(-50%, -50%);
//     ">${name}</div>`,
//     iconSize: undefined,
//     iconAnchor: [0, 0],
//   });
// }

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
      {zoom >= SHAPES_MIN_ZOOM && (
        <SVGOverlay
          bounds={SHAPES_OVERLAY_BOUNDS}
          interactive={false}
          attributes={{
            viewBox: `0 0 ${SHAPES_REFERENCE_SIZE.width} ${SHAPES_REFERENCE_SIZE.height}`,
            preserveAspectRatio: 'none',
            style: 'pointer-events: none;',
          }}
        >
          {shapes.map((shape, index) => {
            if (shape.type === 'line') {
              const [x1, y1, x2, y2] = shape.points;

              return (
                <line
                  key={`shape-line-${index}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={shape.color}
                  strokeWidth={shape.strokeWidth}
                />
              );
            }

            return (
              <rect
                key={`shape-rectangle-${index}`}
                x={shape.x - shape.width / 2}
                y={shape.y - shape.height / 2}
                width={shape.width}
                height={shape.height}
                fill={shape.color}
                stroke={shape.color}
                strokeWidth={shape.strokeWidth}
                transform={`rotate(${shape.rotation} ${shape.x} ${shape.y})`}
              />
            );
          })}
        </SVGOverlay>
      )}
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
