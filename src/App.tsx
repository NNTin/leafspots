import { useState } from 'react';
import { categories, spots as allSpots } from './data/spots';
import type { Category } from './data/spots';
import type { Coordinates } from './utils/distance';
import MapView from './components/MapView';
import Filters from './components/Filters';
import LocationInput from './components/LocationInput';
import './App.css';

function App() {
  const [activeCategories, setActiveCategories] = useState<Set<Category>>(new Set(categories));
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
        <span className="spot-count">
          {visibleSpots.length} spot{visibleSpots.length !== 1 ? 's' : ''} visible
        </span>
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
          <MapView spots={visibleSpots} userLocation={userLocation} />
        </main>
      </div>
    </div>
  );
}

export default App;
