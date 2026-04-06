import { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import type { Coordinates } from './utils/distance';
import MapView from './components/MapView';
import LocationInput from './components/LocationInput';
import DrawingControls from './components/DrawingControls';
import ShareButton from './components/ShareButton';
import SocialIcons from './components/SocialIcons';
import type { MenuItem } from './components/OverflowMenuBar';
import { useDrawing } from './hooks/useDrawing';
import { usePins } from './hooks/usePins';
import { useOrientation } from './hooks/useOrientation';
import { loadStateFromUrl, buildShareUrl } from './utils/urlState';
import type { MapState } from './utils/urlState';
import './App.css';

const BAVARIA_CENTER: [number, number] = [48.79, 11.5];
const DEFAULT_ZOOM = 8;

// Read any saved state from the URL once at module load time
const urlState = loadStateFromUrl();

function App() {
  const [userLocation, setUserLocation] = useState<Coordinates | null>(
    urlState?.pin ? { lat: urlState.pin[0], lng: urlState.pin[1] } : null,
  );
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const orientation = useOrientation();
  const [strokeColor, setStrokeColor] = useState('#e53935');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [shareMessage, setShareMessage] = useState('');
  const [pinMode, setPinMode] = useState(false);
  const [pinColor, setPinColor] = useState('#e53935');
  const [overflowItems, setOverflowItems] = useState<MenuItem[]>([]);
  const [showFullTitle, setShowFullTitle] = useState(true);

  const headerRef = useRef<HTMLElement>(null);
  const headerLeftRef = useRef<HTMLDivElement>(null);
  const fullTitleMeasureRef = useRef<HTMLSpanElement>(null);

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

  const recalculateTitle = useCallback(() => {
    const headerEl = headerRef.current;
    const headerLeftEl = headerLeftRef.current;
    const measureEl = fullTitleMeasureRef.current;

    if (!headerEl || !headerLeftEl || !measureEl) return;

    if (overflowItems.length > 0) {
      setShowFullTitle(false);
      return;
    }

    const headerStyles = getComputedStyle(headerEl);
    const headerGap = parseFloat(headerStyles.columnGap || headerStyles.gap || '0') || 0;
    const headerPaddingX =
      (parseFloat(headerStyles.paddingLeft || '0') || 0) +
      (parseFloat(headerStyles.paddingRight || '0') || 0);
    const availableWidth = headerEl.clientWidth - headerPaddingX;

    const leftStyles = getComputedStyle(headerLeftEl);
    const leftGap = parseFloat(leftStyles.columnGap || leftStyles.gap || '0') || 0;

    const toggleEl = headerLeftEl.querySelector('.sidebar-toggle') as HTMLElement | null;
    const overflowBarEl = headerLeftEl.querySelector('.overflow-menu-bar') as HTMLElement | null;

    const toggleWidth = toggleEl?.offsetWidth ?? 0;

    let visibleToolbarWidth = 0;
    if (overflowBarEl) {
      const barStyles = getComputedStyle(overflowBarEl);
      const barGap = parseFloat(barStyles.columnGap || barStyles.gap || '0') || 0;
      const itemEls = Array.from(overflowBarEl.children).filter((child) =>
        (child as HTMLElement).classList.contains('overflow-menu-item'),
      ) as HTMLElement[];
      visibleToolbarWidth =
        itemEls.reduce((sum, item) => sum + item.offsetWidth, 0) +
        Math.max(0, itemEls.length - 1) * barGap;
    }

    const leftWidth = toggleWidth + (visibleToolbarWidth > 0 ? leftGap : 0) + visibleToolbarWidth;
    const fullTitleWidth = measureEl.offsetWidth;

    setShowFullTitle(leftWidth + headerGap + fullTitleWidth <= availableWidth - 2);
  }, [overflowItems.length]);

  useLayoutEffect(() => {
    recalculateTitle();
  }, [recalculateTitle]);

  useEffect(() => {
    const headerEl = headerRef.current;
    const headerLeftEl = headerLeftRef.current;

    if (!headerEl || !headerLeftEl) return;

    const observer = new ResizeObserver(() => {
      recalculateTitle();
    });

    observer.observe(headerEl);
    observer.observe(headerLeftEl);

    return () => observer.disconnect();
  }, [recalculateTitle]);

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

  return (
    <div className="app">
      <header ref={headerRef} className="app-header">
        <div ref={headerLeftRef} className="header-left">
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

        <h1>{showFullTitle ? '🍃 Leafspots' : '🍃'}</h1>
        <span ref={fullTitleMeasureRef} className="title-measure-full" aria-hidden="true">
          🍃 Leafspots
        </span>
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
            <div className="share-panel">
              <ShareButton getShareUrl={getShareUrl} />
            </div>
            {orientation === 'portrait' ? (
              <div className="sidebar-rotate-message" role="status">
                🔄 Rotate your phone to horizontal mode for a better experience
              </div>
            ) : (
              <SocialIcons />
            )}
          </aside>
        )}
        <main className="map-container">
          <MapView
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
