import { useState, useCallback, useRef } from 'react';
import { categories, spots as allSpots } from './data/spots';
import type { Category } from './data/spots';
import type { Coordinates } from './utils/distance';
import MapView from './components/MapView';
import Filters from './components/Filters';
import LocationInput from './components/LocationInput';
import DrawingControls from './components/DrawingControls';
import { useDrawing } from './hooks/useDrawing';
import { loadStateFromUrl, buildShareUrl } from './utils/urlState';
import type { MapState } from './utils/urlState';
import './App.css';

const BAVARIA_CENTER: [number, number] = [48.79, 11.5];
const DEFAULT_ZOOM = 8;

// Read any saved state from the URL once at module load time
const urlState = loadStateFromUrl();

function App() {
  const [activeCategories, setActiveCategories] = useState<Set<Category>>(new Set(categories));
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [strokeColor, setStrokeColor] = useState('#e53935');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [shareMessage, setShareMessage] = useState('');

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
    };
    const url = buildShareUrl(state);
    navigator.clipboard.writeText(url).then(() => {
      setShareMessage('✓ Link copied!');
      setTimeout(() => setShareMessage(''), 2000);
    }).catch(() => {
      // Clipboard unavailable — update address bar so user can copy manually
      window.history.replaceState(null, '', url);
      setShareMessage('URL updated — copy from address bar');
      setTimeout(() => setShareMessage(''), 4000);
    });
  }, [strokes]);

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
          {shareMessage && <span className="copy-success">{shareMessage}</span>}
          <span className="spot-count">
            {visibleSpots.length} spot{visibleSpots.length !== 1 ? 's' : ''} visible
          </span>
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
          />
        </main>
      </div>
    </div>
  );
}

export default App;
