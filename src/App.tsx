import { useState, useCallback, useRef } from 'react';
import { spots as allSpots } from './data/spots';
import type { Category } from './data/spots';
import type { Coordinates } from './utils/distance';
import MapView from './components/MapView';
import Filters from './components/Filters';
import LocationInput from './components/LocationInput';
import DrawingControls from './components/DrawingControls';
import QRModal from './components/QRModal';
import { useDrawing } from './hooks/useDrawing';
import { loadStateFromUrl, buildShareUrl } from './utils/urlState';
import type { MapState } from './utils/urlState';
import './App.css';

const BAVARIA_CENTER: [number, number] = [48.79, 11.5];
const DEFAULT_ZOOM = 8;

// Read any saved state from the URL once at module load time
const urlState = loadStateFromUrl();

function App() {
  const [activeCategories, setActiveCategories] = useState<Set<Category>>(new Set());
  const [userLocation, setUserLocation] = useState<Coordinates | null>(
    urlState?.pin ? { lat: urlState.pin[0], lng: urlState.pin[1] } : null,
  );
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [strokeColor, setStrokeColor] = useState('#e53935');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  // Track current map view via refs (no re-render needed)
  const mapCenterRef = useRef<[number, number]>(urlState?.center ?? BAVARIA_CENTER);
  const mapZoomRef = useRef<number>(urlState?.zoom ?? DEFAULT_ZOOM);

  const { drawMode, strokes, toggleDrawMode, addStroke, undoLastStroke, clearStrokes } =
    useDrawing(urlState?.strokes ?? []);

  const handleViewChange = useCallback((center: [number, number], zoom: number) => {
    mapCenterRef.current = center;
    mapZoomRef.current = zoom;
  }, []);

  const handleExport = useCallback(() => {
    const state: MapState = {
      center: mapCenterRef.current,
      zoom: mapZoomRef.current,
      strokes,
      pin: userLocation ? [userLocation.lat, userLocation.lng] : null,
    };
    setQrUrl(buildShareUrl(state));
  }, [strokes, userLocation]);

  const visibleSpots = allSpots.filter((s) => activeCategories.has(s.category));

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label="Toggle sidebar"
          >
            ☰
          </button>
          <h1>🍃 Leafspots</h1>
        </div>

        <DrawingControls
          drawMode={drawMode}
          hasStrokes={strokes.length > 0}
          onToggleDrawMode={toggleDrawMode}
          onUndo={undoLastStroke}
          onClear={clearStrokes}
          onExport={handleExport}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
          onColorChange={setStrokeColor}
          onWidthChange={setStrokeWidth}
        />

        <div className="header-right">
        </div>
      </header>

      <div className="app-body">
        {sidebarOpen && (
          <aside className="sidebar">
            <LocationInput
              userLocation={userLocation}
              onLocationChange={setUserLocation}
            />
            <Filters
              activeCategories={activeCategories}
              onChange={setActiveCategories}
            />
          </aside>
        )}
        <main className="map-container">
          <MapView
            spots={visibleSpots}
            userLocation={userLocation}
            initialCenter={urlState?.center}
            initialZoom={urlState?.zoom}
            strokes={strokes}
            drawMode={drawMode}
            strokeColor={strokeColor}
            strokeWidth={strokeWidth}
            onStrokeComplete={addStroke}
            onViewChange={handleViewChange}
            sidebarOpen={sidebarOpen}
          />
        </main>
      </div>

      {qrUrl && <QRModal url={qrUrl} onClose={() => setQrUrl(null)} />}
    </div>
  );
}

export default App;
