# Leafspots 🍃🍺

Leafspots is a map-first React + Vite SPA for drawing, pinning, and sharing places through a URL.

## Installation & Running Locally

```bash
git clone <repository-url>
cd leafspots
npm install
npm run dev
```

Then open the local URL shown by Vite (usually `http://localhost:5173`).

## Live Link

https://nntin.xyz/leafspots/

## Privacy

- Leafspots is a Single Page Application (SPA) with no backend.
- No user data is collected or stored on a server.
- Location and map state are encoded directly into the URL query parameter (`?state=`).
- Only people with the shared link can access that encoded location/map information.
- You are encouraged to fork this project and adapt it to your own needs.

## Architecture Diagram

The diagram below mirrors the implementation naming in the codebase (`LocationInput`, `ShareButton`, `getShareUrl`, `buildShareUrl`, `encodeMapState`, and `loadStateFromUrl`).

```mermaid
sequenceDiagram
    actor User
    participant LocationInput
    participant App
    participant URLState as urlState.ts
    participant ShareButton
    actor LinkReceiver as Viewer with Link

    User->>LocationInput: Enter/select location
    LocationInput->>App: onLocationChange(setUserLocation)

    User->>ShareButton: Click "Share"
    ShareButton->>App: getShareUrl()
    App->>URLState: buildShareUrl(state: MapState)
    URLState->>URLState: encodeMapState(state)
    URLState-->>App: Full URL with ?state=<encoded>
    App-->>ShareButton: return URL

    alt Web Share API available
        ShareButton->>User: navigator.share({ url })
    else Fallback copy flow
        ShareButton->>User: Show URL + copy button
    end

    User->>LinkReceiver: Share URL
    LinkReceiver->>App: Open shared link
    App->>URLState: loadStateFromUrl()
    URLState->>URLState: decodeMapState(encoded)
    URLState-->>App: Restored MapState (center/zoom/pin/pins/strokes)
    App-->>LinkReceiver: Render shared location/map state
```

<p align="center"><small>Built with ♥ in preparation for Bergkirchweih, my hometown for the years 2016–2024.</small></p>