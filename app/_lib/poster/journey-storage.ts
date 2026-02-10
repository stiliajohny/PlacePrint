import type { MarkerIcon, MarkerSize, PosterOutput } from "@/app/_lib/poster/types";
import type { SupportedFormat } from "@/app/_lib/poster/constants";

export const JOURNEY_PAYLOAD_STORAGE_KEY = "placeprint-journey-payload";
export const JOURNEY_RESULT_STORAGE_KEY = "placeprint-journey-result";

export type JourneyPayload = {
  city: string;
  country: string;
  latitude?: string;
  longitude?: string;
  showMarker?: boolean;
  markerColor?: string;
  markerIcon?: MarkerIcon;
  markerSize?: MarkerSize;
  theme: string;
  distance: number;
  width: number;
  height: number;
  format: SupportedFormat;
  displayCity?: string;
  displayCountry?: string;
};

export type JourneyResult = {
  payload: JourneyPayload;
  outputs: PosterOutput[];
  logs: string;
  generatedAt: string;
};
