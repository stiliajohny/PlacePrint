import type { SupportedFormat } from "@/app/_lib/poster/constants";

export type MarkerIcon = "none" | "dot" | "plus" | "star";
export type MarkerSize = "small" | "medium" | "large";

export type ThemeSummary = {
  id: string;
  name: string;
  description: string;
  colors: Record<string, string>;
};

export type PosterRequestInput = {
  city?: unknown;
  country?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  showMarker?: unknown;
  markerColor?: unknown;
  markerIcon?: unknown;
  markerSize?: unknown;
  countryLabel?: unknown;
  theme?: unknown;
  allThemes?: unknown;
  distance?: unknown;
  width?: unknown;
  height?: unknown;
  displayCity?: unknown;
  displayCountry?: unknown;
  fontFamily?: unknown;
  format?: unknown;
};

export type PosterRequest = {
  city: string;
  country: string;
  latitude?: string;
  longitude?: string;
  showMarker: boolean;
  markerColor: string;
  markerIcon: MarkerIcon;
  markerSize: MarkerSize;
  countryLabel?: string;
  theme: string;
  allThemes: boolean;
  distance: number;
  width: number;
  height: number;
  displayCity?: string;
  displayCountry?: string;
  fontFamily?: string;
  format: SupportedFormat;
};

export type PosterOutput = {
  relativePath: string;
  fileName: string;
  format: string;
  downloadUrl: string;
  previewUrl: string | null;
};

export type PosterTheme = {
  name: string;
  description: string;
  bg: string;
  text: string;
  gradient_color: string;
  water: string;
  parks: string;
  road_motorway: string;
  road_primary: string;
  road_secondary: string;
  road_tertiary: string;
  road_residential: string;
  road_default: string;
};

export type LatLon = {
  lat: number;
  lon: number;
};

export type LatLonPoint = [number, number];

export type PolygonRings = {
  rings: LatLonPoint[][];
};

export type ProjectedPoint = {
  x: number;
  y: number;
};

export type RoadFeature = {
  highway: string;
  points: LatLonPoint[];
};

export type ProjectedRoadFeature = {
  highway: string;
  points: ProjectedPoint[];
};

export type ProjectedPolygonRings = {
  rings: ProjectedPoint[][];
};

export type LocalProjection = {
  centerLat: number;
  centerLon: number;
  centerSinLat: number;
  centerCosLat: number;
  centerSinLon: number;
  centerCosLon: number;
  centerEcefX: number;
  centerEcefY: number;
  centerEcefZ: number;
};

export type PosterScene = {
  widthPx: number;
  heightPx: number;
  theme: PosterTheme;
  marker: ProjectedPoint | null;
  markerColor: string;
  markerIcon: MarkerIcon;
  markerSize: MarkerSize;
  water: ProjectedPolygonRings[];
  parks: ProjectedPolygonRings[];
  roads: ProjectedRoadFeature[];
  mainTitle: string;
  countryTitle: string;
  coordinatesLabel: string;
  scaleFactor: number;
  fontFamilyMain: string;
  fontFamilySub: string;
  fontFamilyCoords: string;
  fontFamilyAttr: string;
  fontSizeMain: number;
  fontSizeSub: number;
  fontSizeCoords: number;
  fontSizeAttr: number;
};
