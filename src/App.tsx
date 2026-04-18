import { useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { flushSync } from 'react-dom';
import type { Map as LeafletMap } from 'leaflet';
import type { Coordinates } from './utils/distance';
import MapView from './components/MapView';
import LocationInput from './components/LocationInput';
import DrawingControls from './components/DrawingControls';
import ShareButton from './components/ShareButton';
import NavShareButton from './components/NavShareButton';
import LeafletPanel from './components/LeafletPanel';
import SidebarSocialIcons from './components/SidebarSocialIcons';
import GpsButton from './components/GpsButton';
import InstallBanner from './components/InstallBanner';
import type { MenuItem } from './components/OverflowMenuBar';
import { useDrawing } from './hooks/useDrawing';
import { usePins } from './hooks/usePins';
import { useOrientation } from './hooks/useOrientation';
import { useLeafletConnection } from './hooks/useLeafletConnection';
import { useInstallPrompt } from './hooks/useInstallPrompt';
import { loadStateFromUrl, buildShareUrl } from './utils/urlState';
import { captureMapViewImage } from './utils/mapShareImage';
import { shortenUrl } from './lib/leaflet-client';
import type { MapState } from './utils/urlState';
import './App.css';

const BAVARIA_CENTER: [number, number] = [48.79, 11.5];
const DEFAULT_ZOOM = 8;
type ShareToastTone = 'success' | 'error';
type ShareToast = { message: string; tone: ShareToastTone } | null;
type EditingMarker =
  | { kind: 'custom-pin'; id: string }
  | { kind: 'event-area'; placeId: number };
type EventAreaMarkerOverrideMap = Record<number, { title: string; description: string }>;

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
  const [shareToast, setShareToast] = useState<ShareToast>(null);
  const [shareCaptureActive, setShareCaptureActive] = useState(false);
  const [pinMode, setPinMode] = useState(false);
  const [pinColor, setPinColor] = useState('#e53935');
  const [overflowItems, setOverflowItems] = useState<MenuItem[]>([]);
  const [showFullTitle, setShowFullTitle] = useState(true);
  const [editingMarker, setEditingMarker] = useState<EditingMarker | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [selectedTtl, setSelectedTtl] = useState('5m');
  const [eventAreaMarkerOverrides, setEventAreaMarkerOverrides] = useState<EventAreaMarkerOverrideMap>(
    () =>
      (urlState?.areaPins ?? []).reduce<EventAreaMarkerOverrideMap>((acc, [placeId, title, description]) => {
        acc[placeId] = { title, description };
        return acc;
      }, {}),
  );

  const headerRef = useRef<HTMLElement>(null);
  const headerLeftRef = useRef<HTMLDivElement>(null);
  const fullTitleMeasureRef = useRef<HTMLSpanElement>(null);
  const editTitleRef = useRef<HTMLInputElement>(null);
  const shareToastTimeoutRef = useRef<number | null>(null);
  const mapViewRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<LeafletMap | null>(null);

  // Track current map view via refs (no re-render needed)
  const mapCenterRef = useRef<[number, number]>(urlState?.center ?? BAVARIA_CENTER);
  const mapZoomRef = useRef<number>(urlState?.zoom ?? DEFAULT_ZOOM);

  const { drawMode, strokes, toggleDrawMode, addStroke, undoLastStroke, clearStrokes } =
    useDrawing(urlState?.strokes ?? []);

  const { pins, addPin, movePin, updatePin, clearPins } = usePins(
    () => urlState?.pins?.map(([lat, lng, color, title, description]) => ({
      id: crypto.randomUUID(), lat, lng, color, title: title ?? '', description: description ?? '',
    })) ?? [],
  );

  const leaflet = useLeafletConnection();
  const { installState, install, dismiss } = useInstallPrompt();

  const effectiveSelectedTtl = useMemo(() => {
    const opts = leaflet.capabilities?.ttlOptions;
    if (!opts || opts.length === 0) return selectedTtl;
    return opts.some((o) => o.value === selectedTtl) ? selectedTtl : opts[0].value;
  }, [leaflet.capabilities, selectedTtl]);

  const effectiveSelectedTtlLabel = useMemo(() => {
    return leaflet.capabilities?.ttlOptions.find((opt) => opt.value === effectiveSelectedTtl)?.label;
  }, [effectiveSelectedTtl, leaflet.capabilities]);

  const shortenCacheScope = useMemo(() => {
    return leaflet.connectionState === 'authenticated'
      ? `auth:${leaflet.username ?? ''}`
      : 'anonymous';
  }, [leaflet.connectionState, leaflet.username]);

  // Draw mode and pin mode are mutually exclusive
  const handleToggleDrawMode = useCallback(() => {
    if (pinMode) setPinMode(false);
    toggleDrawMode();
  }, [pinMode, toggleDrawMode]);

  const handleTogglePinMode = useCallback(() => {
    if (drawMode) toggleDrawMode();
    setPinMode((prev) => !prev);
  }, [drawMode, toggleDrawMode]);

  const handleEditPin = useCallback((id: string) => {
    const pin = pins.find((p) => p.id === id);
    if (!pin) return;
    setEditTitle(pin.title);
    setEditDescription(pin.description);
    setEditingMarker({ kind: 'custom-pin', id });
    setSidebarOpen(true);
  }, [pins]);

  const handleEditAreaMarker = useCallback((placeId: number, title: string, description: string) => {
    setEditTitle(title);
    setEditDescription(description);
    setEditingMarker({ kind: 'event-area', placeId });
    setSidebarOpen(true);
  }, []);

  const handleSaveMarker = useCallback(() => {
    if (editingMarker === null) return;

    if (editingMarker.kind === 'custom-pin') {
      updatePin(editingMarker.id, { title: editTitle, description: editDescription });
    } else {
      setEventAreaMarkerOverrides((current) => ({
        ...current,
        [editingMarker.placeId]: {
          title: editTitle,
          description: editDescription,
        },
      }));
    }

    setEditingMarker(null);
  }, [editDescription, editTitle, editingMarker, updatePin]);

  const handleCancelEdit = useCallback(() => {
    setEditingMarker(null);
  }, []);

  const handleViewChange = useCallback((center: [number, number], zoom: number) => {
    mapCenterRef.current = center;
    mapZoomRef.current = zoom;
  }, []);

  const handleMapReady = useCallback((map: LeafletMap) => {
    leafletMapRef.current = map;
  }, []);

  const showShareMessage = useCallback((message: string, tone: ShareToastTone = 'success') => {
    if (shareToastTimeoutRef.current !== null) {
      window.clearTimeout(shareToastTimeoutRef.current);
    }

    setShareToast({ message, tone });
    shareToastTimeoutRef.current = window.setTimeout(() => {
      setShareToast(null);
      shareToastTimeoutRef.current = null;
    }, tone === 'error' || message.includes('URL updated') ? 4000 : 2000);
  }, []);

  useEffect(() => () => {
    if (shareToastTimeoutRef.current !== null) {
      window.clearTimeout(shareToastTimeoutRef.current);
    }
  }, []);

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
    const frameId = window.requestAnimationFrame(() => {
      recalculateTitle();
    });
    return () => window.cancelAnimationFrame(frameId);
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

  useEffect(() => {
    if (editingMarker !== null) {
      const timerId = setTimeout(() => editTitleRef.current?.focus(), 50);
      return () => clearTimeout(timerId);
    }
  }, [editingMarker]);

  const getShareUrl = useCallback((): string => {
    const state: MapState = {
      center: mapCenterRef.current,
      zoom: mapZoomRef.current,
      strokes,
      pin: userLocation ? [userLocation.lat, userLocation.lng] : null,
      pins: pins.map(({ lat, lng, color, title, description }) => [lat, lng, color, title, description]),
      areaPins: Object.entries(eventAreaMarkerOverrides).map(([placeId, { title, description }]) => [
        Number(placeId),
        title,
        description,
      ]),
    };
    return buildShareUrl(state);
  }, [eventAreaMarkerOverrides, strokes, userLocation, pins]);

  const getShareFile = useCallback(async (): Promise<File | null> => {
    const mapElement = mapViewRef.current;
    if (!mapElement) return null;

    const shouldExpandMapForCapture = sidebarOpen;

    if (shouldExpandMapForCapture) {
      flushSync(() => {
        setShareCaptureActive(true);
      });
      mapElement.getBoundingClientRect();
      leafletMapRef.current?.invalidateSize({ pan: false });
    }

    try {
      return await captureMapViewImage(mapElement);
    } finally {
      if (shouldExpandMapForCapture) {
        flushSync(() => {
          setShareCaptureActive(false);
        });
        mapElement.getBoundingClientRect();
        leafletMapRef.current?.invalidateSize({ pan: false });
      }
    }
  }, [sidebarOpen]);

  // Only wire the shortener when the user is connected and shortening is allowed.
  const isConnected =
    leaflet.connectionState === 'anonymous' || leaflet.connectionState === 'authenticated';
  const shorteningEnabled =
    isConnected && (leaflet.capabilities?.shortenAllowed ?? false);

  const getShortenedUrl = useCallback(
    (longUrl: string) => shortenUrl(longUrl, effectiveSelectedTtl, { cacheScope: shortenCacheScope }),
    [effectiveSelectedTtl, shortenCacheScope],
  );

  const handleOpenSidebar = useCallback(() => {
    setSidebarOpen(true);
  }, []);

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
            shareControl={(
              <NavShareButton
                connected={isConnected}
                getShareUrl={getShareUrl}
                getShareFile={getShareFile}
                selectedTtl={shorteningEnabled ? effectiveSelectedTtl : undefined}
                selectedTtlLabel={shorteningEnabled ? effectiveSelectedTtlLabel : undefined}
                getShortenedUrl={shorteningEnabled ? getShortenedUrl : undefined}
                onCopied={showShareMessage}
                onOpenSidebar={handleOpenSidebar}
              />
            )}
            onOverflowChange={setOverflowItems}
          />
        </div>

        <h1>{showFullTitle ? '🍃 Leafspots' : '🍃'}</h1>
        <span ref={fullTitleMeasureRef} className="title-measure-full" aria-hidden="true">
          🍃 Leafspots
        </span>
      </header>

      {shareToast && (
        <div
          className={`toast-notification toast-${shareToast.tone}`}
          role={shareToast.tone === 'error' ? 'alert' : 'status'}
          aria-live={shareToast.tone === 'error' ? 'assertive' : 'polite'}
        >
          {shareToast.message}
        </div>
      )}

      <div className={`app-body${shareCaptureActive ? ' app-body-share-capture' : ''}`}>
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
            {editingMarker !== null && (
              <div className="edit-pin-panel">
                <h2>Edit Marker</h2>
                <div className="edit-pin-form">
                  <label>
                    Title
                    <input
                      ref={editTitleRef}
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveMarker();
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      placeholder="Marker title"
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Escape') handleCancelEdit(); }}
                      placeholder="Description (optional)"
                      rows={3}
                    />
                  </label>
                  <div className="edit-pin-actions">
                    <button onClick={handleSaveMarker}>Save</button>
                    <button onClick={handleCancelEdit}>Cancel</button>
                  </div>
                </div>
              </div>
            )}
            <LocationInput
              userLocation={userLocation}
              onLocationChange={setUserLocation}
            />
            <div className="share-panel">
              <ShareButton
                connected={isConnected}
                getShareUrl={getShareUrl}
                getShareFile={getShareFile}
                selectedTtl={shorteningEnabled ? effectiveSelectedTtl : undefined}
                selectedTtlLabel={shorteningEnabled ? effectiveSelectedTtlLabel : undefined}
                getShortenedUrl={shorteningEnabled ? getShortenedUrl : undefined}
                onOpenSidebar={handleOpenSidebar}
              />
            </div>
            <LeafletPanel
              {...leaflet}
              selectedTtl={effectiveSelectedTtl}
              onTtlChange={setSelectedTtl}
            />
            {orientation === 'portrait' ? (
              <div className="sidebar-rotate-message" role="status">
                🔄 Rotate your phone to horizontal mode for a better experience
              </div>
            ) : (
              <SidebarSocialIcons />
            )}
          </aside>
        )}
        <main className="map-container">
          <MapView
            ref={mapViewRef}
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
            layoutInvalidationKey={shareCaptureActive ? 'share-capture' : 'default'}
            onMapReady={handleMapReady}
            pins={pins}
            pinMode={pinMode}
            pinColor={pinColor}
            onPinAdd={addPin}
            onPinMove={movePin}
            onEditPin={handleEditPin}
            eventAreaMarkerOverrides={eventAreaMarkerOverrides}
            onEditAreaMarker={handleEditAreaMarker}
          />
          <GpsButton onLocationDetected={setUserLocation} />
        </main>
      </div>

      <InstallBanner state={installState} onInstall={install} onDismiss={dismiss} />
    </div>
  );
}

export default App;
