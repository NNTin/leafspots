import { useState } from 'react';
import type { Coordinates } from '../utils/distance';

interface LocationInputProps {
  userLocation: Coordinates | null;
  onLocationChange: (loc: Coordinates | null) => void;
}

export default function LocationInput({ userLocation, onLocationChange }: LocationInputProps) {
  const [latInput, setLatInput] = useState('');
  const [lngInput, setLngInput] = useState('');
  const [geoError, setGeoError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleDetect() {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }
    setLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onLocationChange({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLatInput(pos.coords.latitude.toFixed(5));
        setLngInput(pos.coords.longitude.toFixed(5));
        setLoading(false);
      },
      (err) => {
        setGeoError(err.message);
        setLoading(false);
      },
    );
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (isNaN(lat) || isNaN(lng)) {
      setGeoError('Please enter valid latitude and longitude values.');
      return;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setGeoError('Coordinates out of valid range.');
      return;
    }
    setGeoError(null);
    onLocationChange({ lat, lng });
  }

  function handleClear() {
    onLocationChange(null);
    setLatInput('');
    setLngInput('');
    setGeoError(null);
  }

  return (
    <div className="location-panel">
      <h2>Your Location</h2>
      <button className="detect-btn" onClick={handleDetect} disabled={loading}>
        {loading ? 'Detecting…' : '📍 Use My Location'}
      </button>
      {geoError && <p className="geo-error">{geoError}</p>}
      <form className="manual-form" onSubmit={handleManualSubmit}>
        <label>
          Lat
          <input
            type="number"
            step="any"
            placeholder="e.g. 48.137"
            value={latInput}
            onChange={(e) => setLatInput(e.target.value)}
          />
        </label>
        <label>
          Lng
          <input
            type="number"
            step="any"
            placeholder="e.g. 11.576"
            value={lngInput}
            onChange={(e) => setLngInput(e.target.value)}
          />
        </label>
        <button type="submit">Set Location</button>
      </form>
      {userLocation && (
        <div className="current-location">
          <p>
            📌 {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
          </p>
          <button className="clear-btn" onClick={handleClear}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
