import type { MarkerIcon, MarkerSize, PosterOutput } from "@/app/_lib/poster/types";

type JourneySupportedFormat = "png" | "svg" | "pdf";

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
  format: JourneySupportedFormat;
  displayCity?: string;
  displayCountry?: string;
};

export type JourneyResult = {
  payload: JourneyPayload;
  outputs: PosterOutput[];
  logs: string;
  generatedAt: string;
};

type ParseResult<T> = {
  data: T | null;
  error: string | null;
};

const DEFAULT_JOURNEY_PAYLOAD: JourneyPayload = {
  city: "",
  country: "",
  latitude: undefined,
  longitude: undefined,
  showMarker: false,
  markerColor: "#d62828",
  markerIcon: "dot",
  markerSize: "medium",
  theme: "",
  distance: 18_000,
  width: 8.27,
  height: 11.69,
  format: "png",
  displayCity: undefined,
  displayCountry: undefined
};

const MARKER_ICON_SET: ReadonlySet<MarkerIcon> = new Set(["none", "dot", "plus", "star"]);
const MARKER_SIZE_SET: ReadonlySet<MarkerSize> = new Set(["small", "medium", "large"]);
const SUPPORTED_FORMAT_SET: ReadonlySet<JourneySupportedFormat> = new Set(["png", "svg", "pdf"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readPositiveNumber(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return value;
}

function readMarkerIcon(value: unknown): MarkerIcon {
  return typeof value === "string" && MARKER_ICON_SET.has(value as MarkerIcon) ? (value as MarkerIcon) : "dot";
}

function readMarkerSize(value: unknown): MarkerSize {
  return typeof value === "string" && MARKER_SIZE_SET.has(value as MarkerSize) ? (value as MarkerSize) : "medium";
}

function readFormat(value: unknown): JourneySupportedFormat {
  return typeof value === "string" && SUPPORTED_FORMAT_SET.has(value as JourneySupportedFormat)
    ? (value as JourneySupportedFormat)
    : "png";
}

function readBoundedDimension(value: unknown, fallback: number): number {
  const next = readPositiveNumber(value, fallback);
  return Math.min(20, Math.max(1, next));
}

function readOutput(value: unknown): PosterOutput | null {
  if (!isRecord(value)) {
    return null;
  }

  const relativePath = readString(value.relativePath);
  const fileName = readString(value.fileName);
  const downloadUrl = readString(value.downloadUrl);
  if (!relativePath || !fileName || !downloadUrl) {
    return null;
  }

  const previewUrlRaw = value.previewUrl;
  const previewUrl = typeof previewUrlRaw === "string" && previewUrlRaw.trim().length > 0 ? previewUrlRaw : null;
  const format = readString(value.format) ?? "file";

  return {
    relativePath,
    fileName,
    format,
    downloadUrl,
    previewUrl
  };
}

function isPosterOutput(value: PosterOutput | null): value is PosterOutput {
  return value !== null;
}

export function sanitizeJourneyPayload(value: unknown): JourneyPayload | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    city: readString(value.city) ?? "",
    country: readString(value.country) ?? "",
    latitude: readString(value.latitude),
    longitude: readString(value.longitude),
    showMarker: readBoolean(value.showMarker, DEFAULT_JOURNEY_PAYLOAD.showMarker ?? false),
    markerColor: readString(value.markerColor) ?? DEFAULT_JOURNEY_PAYLOAD.markerColor ?? "#d62828",
    markerIcon: readMarkerIcon(value.markerIcon),
    markerSize: readMarkerSize(value.markerSize),
    theme: readString(value.theme) ?? "",
    distance: Math.max(100, Math.round(readPositiveNumber(value.distance, DEFAULT_JOURNEY_PAYLOAD.distance))),
    width: readBoundedDimension(value.width, DEFAULT_JOURNEY_PAYLOAD.width),
    height: readBoundedDimension(value.height, DEFAULT_JOURNEY_PAYLOAD.height),
    format: readFormat(value.format),
    displayCity: readString(value.displayCity),
    displayCountry: readString(value.displayCountry)
  };
}

export function sanitizeJourneyResult(value: unknown): JourneyResult | null {
  if (!isRecord(value)) {
    return null;
  }

  const payload = sanitizeJourneyPayload(value.payload);
  if (!payload) {
    return null;
  }

  const outputs = Array.isArray(value.outputs) ? value.outputs.map(readOutput).filter(isPosterOutput) : [];
  const logs = typeof value.logs === "string" ? value.logs : "";
  const generatedAt = typeof value.generatedAt === "string" ? value.generatedAt : "";

  return {
    payload,
    outputs,
    logs,
    generatedAt
  };
}

export function parseStoredJourneyPayload(raw: string | null): ParseResult<JourneyPayload> {
  if (!raw) {
    return {
      data: null,
      error: "No generation details found. Go back and complete Step 2."
    };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const payload = sanitizeJourneyPayload(parsed);
    if (!payload) {
      return {
        data: null,
        error: "Generation details were invalid. Please complete Step 2 again."
      };
    }

    return { data: payload, error: null };
  } catch {
    return {
      data: null,
      error: "Could not read generation details from this browser session."
    };
  }
}

export function parseStoredJourneyResult(raw: string | null): ParseResult<JourneyResult> {
  if (!raw) {
    return {
      data: null,
      error: "No generated result found in this browser session."
    };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const result = sanitizeJourneyResult(parsed);
    if (!result) {
      return {
        data: null,
        error: "Saved result data was incomplete. Please generate a new poster."
      };
    }

    return { data: result, error: null };
  } catch {
    return {
      data: null,
      error: "Could not read generated result from this browser session."
    };
  }
}
