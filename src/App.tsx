import { useState, useCallback, useRef } from 'react';
import { spots as allSpots } from './data/spots';
import type { Category } from './data/spots';
import type { Coordinates } from './utils/distance';
import MapView from './components/MapView';
import Filters from './components/Filters';
import LocationInput from './components/LocationInput';
import DrawingControls from './components/DrawingControls';
import ShareButton from './components/ShareButton';
import type { MenuItem } from './components/OverflowMenuBar';
import { useDrawing } from './hooks/useDrawing';
import { usePins } from './hooks/usePins';
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
  const [shareMessage, setShareMessage] = useState('');
  const [pinMode, setPinMode] = useState(false);
  const [pinColor, setPinColor] = useState('#e53935');
  const [overflowItems, setOverflowItems] = useState<MenuItem[]>([]);

  // Track current map view via refs (no re-render needed)
  const mapCenterRef = useRef<[number, number]>(urlState?.center ?? BAVARIA_CENTER);
  const mapZoomRef = useRef<number>(urlState?.zoom ?? DEFAULT_ZOOM);

  const { drawMode, strokes, toggleDrawMode, addStroke, undoLastStroke, clearStrokes } =
    useDrawing(urlState?.strokes ?? []);

  const { pins, addPin, movePin, clearPins } = usePins(
    () => urlState?.pins?.map(([lat, lng, color]) => ({ id: crypto.randomUUID(), lat, lng, color })) ?? [],
  );

  // Draw mode and pin mode are mutually exclusive
  const handleToggleDrawMode = useCallback(() => {
    if (pinMode) setPinMode(false);
    toggleDrawMode();
  }, [pinMode, toggleDrawMode]);

  const handleTogglePinMode = useCallback(() => {
    if (drawMode) toggleDrawMode();
    setPinMode((prev) => !prev);
  }, [drawMode, toggleDrawMode]);

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
      pins: pins.map(({ lat, lng, color }) => [lat, lng, color]),
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
  }, [strokes, userLocation, pins]);

  const getShareUrl = useCallback((): string => {
    const state: MapState = {
      center: mapCenterRef.current,
      zoom: mapZoomRef.current,
      strokes,
      pin: userLocation ? [userLocation.lat, userLocation.lng] : null,
      pins: pins.map(({ lat, lng, color }) => [lat, lng, color]),
    };
    return buildShareUrl(state);
  }, [strokes, userLocation, pins]);

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
            {overflowItems.length > 0 && !sidebarOpen && (
              <span className="sidebar-toggle-dot" aria-hidden="true" />
            )}
          </button>

          <DrawingControls
            drawMode={drawMode}
            hasStrokes={strokes.length > 0}
            onToggleDrawMode={handleToggleDrawMode}
            onUndo={undoLastStroke}
            onClear={clearStrokes}
            onExport={handleExport}
            strokeColor={strokeColor}
            strokeWidth={strokeWidth}
            onColorChange={setStrokeColor}
            onWidthChange={setStrokeWidth}
            pinMode={pinMode}
            hasPins={pins.length > 0}
            pinColor={pinColor}
            onTogglePinMode={handleTogglePinMode}
            onClearPins={clearPins}
            onPinColorChange={setPinColor}
            onOverflowChange={setOverflowItems}
          />
        </div>

        <h1>🍃 Leafspots</h1>
      </header>

      {shareMessage && (
        <div className="toast-notification" role="status" aria-live="polite">
          {shareMessage}
        </div>
      )}

      <div className="app-body">
        {sidebarOpen && (
          <aside className="sidebar">
            {overflowItems.length > 0 && (
              <div className="sidebar-overflow-panel">
                {overflowItems.map((item) => (
                  <div key={item.id} className="sidebar-overflow-item">
                    {item.node}
                  </div>
                ))}
              </div>
            )}
            <LocationInput
              userLocation={userLocation}
              onLocationChange={setUserLocation}
            />
            <Filters
              activeCategories={activeCategories}
              onChange={setActiveCategories}
            />
            <div className="share-panel">
              <ShareButton getShareUrl={getShareUrl} />
            </div>
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
            pins={pins}
            pinMode={pinMode}
            pinColor={pinColor}
            onPinAdd={addPin}
            onPinMove={movePin}
          />
        </main>
      </div>
    </div>
  );
}

export default App;
