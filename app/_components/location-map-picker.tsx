"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type LatLngTuple = [number, number];

type LeafletLatLng = {
  lat: number;
  lng: number;
};

type LeafletMouseEvent = {
  latlng: LeafletLatLng;
};

type LeafletMap = {
  setView: (center: LatLngTuple, zoom: number) => LeafletMap;
  setZoom: (zoom: number) => LeafletMap;
  getZoom: () => number;
  on: (eventName: string, handler: (event: unknown) => void) => LeafletMap;
  off: (eventName: string, handler: (event: unknown) => void) => LeafletMap;
  panTo: (center: LatLngTuple) => LeafletMap;
  invalidateSize: () => void;
  remove: () => void;
};

type LeafletMarker = {
  addTo: (map: LeafletMap) => LeafletMarker;
  setLatLng: (center: LatLngTuple) => LeafletMarker;
  on: (eventName: string, handler: () => void) => LeafletMarker;
  getLatLng: () => LeafletLatLng;
};

type LeafletTileLayer = {
  addTo: (map: LeafletMap) => void;
};

type LeafletGlobal = {
  map: (container: HTMLElement, options?: Record<string, unknown>) => LeafletMap;
  marker: (center: LatLngTuple, options?: { draggable?: boolean }) => LeafletMarker;
  tileLayer: (urlTemplate: string, options?: Record<string, unknown>) => LeafletTileLayer;
};

declare global {
  interface Window {
    L?: LeafletGlobal;
  }
}

type LocationMapPickerProps = {
  latitude: string;
  longitude: string;
  distanceMeters: number;
  posterWidthInches: number;
  posterHeightInches: number;
  isVisible: boolean;
  onCoordinatesChange: (latitude: string, longitude: string) => void;
  onDistanceChange: (distanceMeters: number) => void;
};

const LEAFLET_SCRIPT_ID = "leaflet-script";
const LEAFLET_STYLES_ID = "leaflet-styles";
const LEAFLET_SCRIPT_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const LEAFLET_STYLES_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const DEFAULT_CENTER: LatLngTuple = [20, 0];
const DEFAULT_ZOOM = 2;
const ACTIVE_ZOOM = 13;
const COORDINATE_DIGITS = 6;
const ZOOM_DECIMALS = 1;
const MIN_ZOOM = 2;
const MAX_ZOOM = 19;
const MIN_DISTANCE_METERS = 100;
const EARTH_METERS_PER_PIXEL = 156543.03392;

let leafletPromise: Promise<LeafletGlobal> | null = null;

function parseCoordinate(raw: string, min: number, max: number): number | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (parsed < min || parsed > max) {
    return null;
  }

  return parsed;
}

function parseCoordinates(latitude: string, longitude: string): LeafletLatLng | null {
  const lat = parseCoordinate(latitude, -90, 90);
  const lng = parseCoordinate(longitude, -180, 180);

  if (lat === null || lng === null) {
    return null;
  }

  return { lat, lng };
}

function clampZoom(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_ZOOM;
  }

  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function clampDistance(value: number): number {
  if (!Number.isFinite(value)) {
    return MIN_DISTANCE_METERS;
  }

  return Math.max(MIN_DISTANCE_METERS, Math.round(value));
}

function latitudeFactor(latitude: number): number {
  const cosine = Math.cos((latitude * Math.PI) / 180);
  return Math.max(0.1, cosine);
}

function viewRadiusPixels(element: HTMLElement | null): number {
  const width = element?.clientWidth ?? 0;
  const height = element?.clientHeight ?? 0;
  const minEdge = Math.min(width, height);
  const safeEdge = minEdge > 0 ? minEdge : 320;
  return safeEdge / 2;
}

function distanceFromZoom(zoom: number, latitude: number, radiusPixels: number): number {
  const metersPerPixel = (EARTH_METERS_PER_PIXEL * latitudeFactor(latitude)) / 2 ** zoom;
  return clampDistance(metersPerPixel * radiusPixels);
}

function zoomFromDistance(distance: number, latitude: number, radiusPixels: number): number {
  const normalizedDistance = clampDistance(distance);
  const normalizedRadius = Math.max(40, radiusPixels);
  const numerator = EARTH_METERS_PER_PIXEL * latitudeFactor(latitude) * normalizedRadius;
  const zoom = Math.log2(numerator / normalizedDistance);
  return clampZoom(zoom);
}

function ensureLeafletAssets(): Promise<LeafletGlobal> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("Map assets can only load in a browser."));
  }

  if (window.L) {
    return Promise.resolve(window.L);
  }

  if (leafletPromise) {
    return leafletPromise;
  }

  leafletPromise = new Promise<LeafletGlobal>((resolve, reject) => {
    const resolveLeaflet = () => {
      if (window.L) {
        resolve(window.L);
        return;
      }
      reject(new Error("Leaflet loaded without a global API."));
    };

    if (!document.getElementById(LEAFLET_STYLES_ID)) {
      const stylesheet = document.createElement("link");
      stylesheet.id = LEAFLET_STYLES_ID;
      stylesheet.rel = "stylesheet";
      stylesheet.href = LEAFLET_STYLES_URL;
      document.head.appendChild(stylesheet);
    }

    const existingScript = document.getElementById(LEAFLET_SCRIPT_ID) as HTMLScriptElement | null;

    if (existingScript?.dataset.loaded === "true") {
      resolveLeaflet();
      return;
    }

    const script = existingScript ?? document.createElement("script");
    if (!existingScript) {
      script.id = LEAFLET_SCRIPT_ID;
      script.src = LEAFLET_SCRIPT_URL;
      script.async = true;
    }

    const onLoad = () => {
      script.dataset.loaded = "true";
      cleanup();
      resolveLeaflet();
    };

    const onError = () => {
      cleanup();
      reject(new Error("Could not load OpenStreetMap map assets."));
    };

    const cleanup = () => {
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
    };

    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);

    if (!existingScript) {
      document.head.appendChild(script);
    }
  }).catch((error) => {
    leafletPromise = null;
    throw error;
  });

  return leafletPromise;
}

export function LocationMapPicker({
  latitude,
  longitude,
  distanceMeters,
  posterWidthInches,
  posterHeightInches,
  isVisible,
  onCoordinatesChange,
  onDistanceChange
}: LocationMapPickerProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const leafletRef = useRef<LeafletGlobal | null>(null);
  const clickHandlerRef = useRef<((event: unknown) => void) | null>(null);
  const zoomHandlerRef = useRef<(() => void) | null>(null);
  const suppressZoomDistanceSyncRef = useRef(false);
  const onCoordinatesChangeRef = useRef(onCoordinatesChange);
  const onDistanceChangeRef = useRef(onDistanceChange);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [zoomLabel, setZoomLabel] = useState<number | null>(null);

  const parsedCoordinates = useMemo(() => parseCoordinates(latitude, longitude), [latitude, longitude]);
  const normalizedDistanceMeters = clampDistance(distanceMeters);
  const mapAspectRatio = useMemo(() => {
    const safeWidth = Number.isFinite(posterWidthInches) && posterWidthInches > 0 ? posterWidthInches : 8.27;
    const safeHeight = Number.isFinite(posterHeightInches) && posterHeightInches > 0 ? posterHeightInches : 11.69;
    return `${safeWidth} / ${safeHeight}`;
  }, [posterHeightInches, posterWidthInches]);

  useEffect(() => {
    onCoordinatesChangeRef.current = onCoordinatesChange;
  }, [onCoordinatesChange]);

  useEffect(() => {
    onDistanceChangeRef.current = onDistanceChange;
  }, [onDistanceChange]);

  const getReferenceLatitude = useCallback(() => {
    return markerRef.current?.getLatLng().lat ?? parsedCoordinates?.lat ?? DEFAULT_CENTER[0];
  }, [parsedCoordinates]);

  const syncDistanceFromZoom = useCallback(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const zoom = clampZoom(map.getZoom());
    setZoomLabel(Number(zoom.toFixed(ZOOM_DECIMALS)));

    if (suppressZoomDistanceSyncRef.current) {
      suppressZoomDistanceSyncRef.current = false;
      return;
    }

    const nextDistance = distanceFromZoom(
      zoom,
      getReferenceLatitude(),
      viewRadiusPixels(mapElementRef.current)
    );
    onDistanceChangeRef.current(nextDistance);
  }, [getReferenceLatitude]);

  const setMarkerPosition = useCallback((lat: number, lng: number, shouldNotify: boolean) => {
    const map = mapRef.current;
    const leaflet = leafletRef.current;
    if (!map || !leaflet) {
      return;
    }

    const point: LatLngTuple = [lat, lng];

    if (!markerRef.current) {
      markerRef.current = leaflet.marker(point, { draggable: true }).addTo(map);
      markerRef.current.on("dragend", () => {
        const dragged = markerRef.current?.getLatLng();
        if (!dragged) {
          return;
        }

        onCoordinatesChangeRef.current(dragged.lat.toFixed(COORDINATE_DIGITS), dragged.lng.toFixed(COORDINATE_DIGITS));
        syncDistanceFromZoom();
      });
    } else {
      markerRef.current.setLatLng(point);
    }

    if (shouldNotify) {
      onCoordinatesChangeRef.current(lat.toFixed(COORDINATE_DIGITS), lng.toFixed(COORDINATE_DIGITS));
    }
  }, [syncDistanceFromZoom]);

  useEffect(() => {
    let isCancelled = false;

    const setupMap = async () => {
      if (!mapElementRef.current || mapRef.current) {
        return;
      }

      try {
        const leaflet = await ensureLeafletAssets();

        if (isCancelled || !mapElementRef.current || mapRef.current) {
          return;
        }

        leafletRef.current = leaflet;
        const map = leaflet.map(mapElementRef.current, { zoomControl: true });

        leaflet
          .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap contributors"
          })
          .addTo(map);

        if (parsedCoordinates) {
          const initialZoom = zoomFromDistance(
            normalizedDistanceMeters,
            parsedCoordinates.lat,
            viewRadiusPixels(mapElementRef.current)
          );
          map.setView([parsedCoordinates.lat, parsedCoordinates.lng], initialZoom || ACTIVE_ZOOM);
          setMarkerPosition(parsedCoordinates.lat, parsedCoordinates.lng, false);
        } else {
          map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
        }

        setZoomLabel(Number(clampZoom(map.getZoom()).toFixed(ZOOM_DECIMALS)));

        const onMapClick = (event: unknown) => {
          const maybeEvent = event as Partial<LeafletMouseEvent> | null;
          const latlng = maybeEvent?.latlng;
          if (!latlng) {
            return;
          }

          setMarkerPosition(latlng.lat, latlng.lng, true);
          syncDistanceFromZoom();
        };

        map.on("click", onMapClick);
        map.on("zoomend", syncDistanceFromZoom);
        mapRef.current = map;
        clickHandlerRef.current = onMapClick;
        zoomHandlerRef.current = syncDistanceFromZoom;

        window.setTimeout(() => {
          mapRef.current?.invalidateSize();
        }, 0);
      } catch {
        if (isCancelled) {
          return;
        }

        setLoadError("Could not load OpenStreetMap picker. Enter coordinates manually instead.");
      }
    };

    void setupMap();

    return () => {
      isCancelled = true;
    };
  }, [normalizedDistanceMeters, parsedCoordinates, setMarkerPosition, syncDistanceFromZoom]);

  useEffect(() => {
    if (!parsedCoordinates) {
      return;
    }

    setMarkerPosition(parsedCoordinates.lat, parsedCoordinates.lng, false);
    mapRef.current?.panTo([parsedCoordinates.lat, parsedCoordinates.lng]);
  }, [parsedCoordinates, setMarkerPosition]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isVisible) {
      return;
    }

    const targetZoom = zoomFromDistance(
      normalizedDistanceMeters,
      getReferenceLatitude(),
      viewRadiusPixels(mapElementRef.current)
    );
    const currentZoom = clampZoom(map.getZoom());

    if (Math.abs(currentZoom - targetZoom) < 0.05) {
      setZoomLabel(Number(currentZoom.toFixed(ZOOM_DECIMALS)));
      return;
    }

    suppressZoomDistanceSyncRef.current = true;
    map.setZoom(targetZoom);
    setZoomLabel(Number(targetZoom.toFixed(ZOOM_DECIMALS)));
  }, [getReferenceLatitude, isVisible, mapAspectRatio, normalizedDistanceMeters]);

  useEffect(() => {
    if (!isVisible || typeof window === "undefined") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      mapRef.current?.invalidateSize();
      syncDistanceFromZoom();
    }, 140);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isVisible, mapAspectRatio, syncDistanceFromZoom]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const onResize = () => {
      mapRef.current?.invalidateSize();
    };

    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    return () => {
      const map = mapRef.current;
      const clickHandler = clickHandlerRef.current;
      const zoomHandler = zoomHandlerRef.current;

      if (map && clickHandler) {
        map.off("click", clickHandler);
      }
      if (map && zoomHandler) {
        map.off("zoomend", zoomHandler);
      }

      map?.remove();
      mapRef.current = null;
      markerRef.current = null;
      clickHandlerRef.current = null;
      zoomHandlerRef.current = null;
    };
  }, []);

  return (
    <div className="map-picker-shell">
      <div
        ref={mapElementRef}
        className="map-picker-canvas"
        aria-label="OpenStreetMap center picker"
        style={{ aspectRatio: mapAspectRatio }}
      />
      <label className="map-distance-control">
        Distance (meters)
        <input
          type="number"
          min={MIN_DISTANCE_METERS}
          step={1}
          value={normalizedDistanceMeters}
          onChange={(event) => onDistanceChangeRef.current(clampDistance(Number(event.target.value) || MIN_DISTANCE_METERS))}
        />
      </label>
      <p className="map-picker-status">
        Zoom: {zoomLabel ? zoomLabel.toFixed(ZOOM_DECIMALS) : "--"} | Coverage radius: {normalizedDistanceMeters.toLocaleString()} m
      </p>
      {loadError ? (
        <p className="geolocation-status is-error" role="status" aria-live="polite">
          {loadError}
        </p>
      ) : null}
      <p className="map-picker-attribution">Map data © OpenStreetMap contributors.</p>
    </div>
  );
}
