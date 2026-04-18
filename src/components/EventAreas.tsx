import { useEffect, useMemo, useRef, useState } from 'react';
import { GeoJSON, Marker, Popup, SVGOverlay, useMap, useMapEvents } from 'react-leaflet';
// import L from 'leaflet';
import type { Geometry, Position } from 'geojson';
import MarkerPopupContent from './MarkerPopupContent';
import SpotMarker from './SpotMarker';

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
  name: string;
  display_name: string;
  geojson: Geometry;
}

interface EventAreasProps {
  markerOverrides?: Record<number, { title: string; description: string }>;
  onEditMarker?: (placeId: number, title: string, description: string) => void;
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

interface ShapeOverlay {
  type: 'overlay';
  src: string;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

type Shape = ShapeLine | ShapeRectangle | ShapeOverlay;
type OverlayAssetDimensions = Record<string, { width: number; height: number }>;

const EVENT_AREAS_DATA_URL = new URL('../data/event-areas.json', import.meta.url).href;
const SHAPES_DATA_URL = new URL('../data/shapes.json', import.meta.url).href;
const APP_BASE_URL = import.meta.env.BASE_URL;
const CUSTOM_AREA_MARKER_COLOR = '#2e7d32';

async function loadJson<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to load JSON from ${url}: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

function resolveOverlayAssetUrl(src: string): string {
  if (
    src.startsWith('http://') ||
    src.startsWith('https://') ||
    src.startsWith('data:') ||
    src.startsWith('blob:')
  ) {
    return src;
  }

  if (src.startsWith('/')) {
    return `${APP_BASE_URL}${src.slice(1)}`;
  }

  return src;
}

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

function getEventAreasOverlayBounds(eventAreas: EventArea[]): [[number, number], [number, number]] | null {
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

  if (
    !Number.isFinite(minLng) ||
    !Number.isFinite(maxLng) ||
    !Number.isFinite(minLat) ||
    !Number.isFinite(maxLat)
  ) {
    return null;
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

function EventAreasInner({
  markerOverrides = {},
  onEditMarker,
}: EventAreasProps) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  const [eventAreas, setEventAreas] = useState<EventArea[]>([]);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const shapesLoadedRef = useRef(false);
  const shapesRequestRef = useRef<Promise<Shape[]> | null>(null);
  const preloadedOverlaySourcesRef = useRef<Set<string>>(new Set());
  const [overlayAssetDimensions, setOverlayAssetDimensions] = useState<OverlayAssetDimensions>({});
  const shapesOverlayBounds = useMemo(() => getEventAreasOverlayBounds(eventAreas), [eventAreas]);
  const overlaySources = useMemo(
    () =>
      Array.from(
        new Set(
          shapes
            .filter((shape): shape is ShapeOverlay => shape.type === 'overlay')
            .map((shape) => resolveOverlayAssetUrl(shape.src)),
        ),
      ),
    [shapes],
  );

  useEffect(() => {
    let isCancelled = false;

    loadJson<EventArea[]>(EVENT_AREAS_DATA_URL)
      .then((data) => {
        if (!isCancelled) {
          setEventAreas(data);
        }
      })
      .catch((error) => {
        console.error(error);
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (zoom < SHAPES_MIN_ZOOM || shapesLoadedRef.current || shapesRequestRef.current) return;

    let isCancelled = false;
    const request = loadJson<Shape[]>(SHAPES_DATA_URL);
    shapesRequestRef.current = request;

    request
      .then((data) => {
        if (!isCancelled) {
          setShapes(data);
          shapesLoadedRef.current = true;
        }

        shapesRequestRef.current = null;
      })
      .catch((error) => {
        shapesRequestRef.current = null;
        console.error(error);
      });

    return () => {
      isCancelled = true;
    };
  }, [zoom]);

  useEffect(() => {
    if (zoom < SHAPES_MIN_ZOOM || overlaySources.length === 0) return;

    let isCancelled = false;

    for (const src of overlaySources) {
      if (preloadedOverlaySourcesRef.current.has(src)) continue;

      const image = new Image();

      image.onload = () => {
        if (isCancelled || image.naturalWidth === 0 || image.naturalHeight === 0) return;
        preloadedOverlaySourcesRef.current.add(src);

        setOverlayAssetDimensions((current) => {
          if (current[src]) return current;

          return {
            ...current,
            [src]: {
              width: image.naturalWidth,
              height: image.naturalHeight,
            },
          };
        });
      };

      image.src = src;
    }

    return () => {
      isCancelled = true;
    };
  }, [overlaySources, zoom]);

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
          style={{ fillOpacity: 0.05, fillColor: '#3388ff' }}
        />
      ))}
      {zoom >= SHAPES_MIN_ZOOM && shapesOverlayBounds && (
        <SVGOverlay
          bounds={shapesOverlayBounds}
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

            if (shape.type === 'overlay') {
              const overlaySrc = resolveOverlayAssetUrl(shape.src);
              const dimensions = overlayAssetDimensions[overlaySrc];

              if (!dimensions) return null;

              return (
                <g key={`shape-overlay-${index}`} transform={`translate(${shape.x} ${shape.y})`}>
                  <g transform={`rotate(${shape.rotation})`}>
                    <g transform={`scale(${shape.scaleX} ${shape.scaleY})`}>
                      <image
                        href={overlaySrc}
                        x={-dimensions.width / 2}
                        y={-dimensions.height / 2}
                        width={dimensions.width}
                        height={dimensions.height}
                        preserveAspectRatio="none"
                      />
                    </g>
                  </g>
                </g>
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
      {eventAreas.map((area) => {
        const lat = Number.parseFloat(area.lat);
        const lng = Number.parseFloat(area.lon);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

        const hasOverride = Object.prototype.hasOwnProperty.call(markerOverrides, area.place_id);
        const override = hasOverride ? markerOverrides[area.place_id] : undefined;
        const markerTitle = override ? (override.title || area.name) : area.name;
        const markerDescription = override ? override.description : area.display_name;

        if (override) {
          return (
            <SpotMarker
              key={`area-marker-${area.place_id}`}
              lat={lat}
              lng={lng}
              name={markerTitle}
              description={markerDescription || undefined}
              color={CUSTOM_AREA_MARKER_COLOR}
              onEdit={
                onEditMarker
                  ? () => onEditMarker(area.place_id, override.title, override.description)
                  : undefined
              }
            />
          );
        }

        return (
          <Marker
            key={`area-marker-${area.place_id}`}
            position={[lat, lng]}
          >
            <Popup>
              <MarkerPopupContent
                title={markerTitle}
                lat={lat}
                lng={lng}
                description={markerDescription}
                onEdit={
                  onEditMarker
                    ? () => onEditMarker(area.place_id, area.name, area.display_name)
                    : undefined
                }
              />
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

export default function EventAreas(props: EventAreasProps) {
  return <EventAreasInner {...props} />;
}
