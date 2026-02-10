import {
  MAX_DIMENSION_INCHES,
  SUPPORTED_FORMATS,
  type SupportedFormat
} from "@/app/_lib/poster/constants";
import { parseCoordinate } from "@/app/_lib/poster/geo";
import type { MarkerIcon, MarkerSize, PosterRequest, PosterRequestInput } from "@/app/_lib/poster/types";

type ValidationResult =
  | { ok: true; value: PosterRequest }
  | { ok: false; errors: string[] };

const DEFAULT_MARKER_COLOR = "#d62828";
const MARKER_ICONS: MarkerIcon[] = ["none", "dot", "plus", "star"];
const MARKER_SIZES: MarkerSize[] = ["small", "medium", "large"];

function toOptionalTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return ["true", "1", "yes", "on"].includes(value.toLowerCase());
  }

  return false;
}

function toFormat(value: unknown): SupportedFormat | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.toLowerCase();
  if (SUPPORTED_FORMATS.includes(normalized as SupportedFormat)) {
    return normalized as SupportedFormat;
  }

  return undefined;
}

function clampDimension(value: number): number {
  if (value <= 0) {
    return 1;
  }

  return Math.min(value, MAX_DIMENSION_INCHES);
}

function normalizeHexColor(value: string): string | undefined {
  const cleaned = value.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    return `#${cleaned
      .split("")
      .map((char) => char + char)
      .join("")
      .toLowerCase()}`;
  }

  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return `#${cleaned.toLowerCase()}`;
  }

  return undefined;
}

function toMarkerIcon(value: unknown): MarkerIcon | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.toLowerCase();
  return MARKER_ICONS.find((icon) => icon === normalized);
}

function toMarkerSize(value: unknown): MarkerSize | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.toLowerCase();
  return MARKER_SIZES.find((size) => size === normalized);
}

export function validatePosterRequest(input: PosterRequestInput): ValidationResult {
  const errors: string[] = [];

  const city = toOptionalTrimmedString(input.city);
  const country = toOptionalTrimmedString(input.country);
  const hasCity = Boolean(city);
  const hasCountry = Boolean(country);
  const hasCityAndCountry = hasCity && hasCountry;

  if ((hasCity && !hasCountry) || (!hasCity && hasCountry)) {
    errors.push("city and country must be provided together");
  }

  const latitude = toOptionalTrimmedString(input.latitude);
  const longitude = toOptionalTrimmedString(input.longitude);
  const hasLatitude = Boolean(latitude);
  const hasLongitude = Boolean(longitude);
  const hasCoordinates = hasLatitude && hasLongitude;
  if ((latitude && !longitude) || (!latitude && longitude)) {
    errors.push("latitude and longitude must be provided together");
  }

  if (!hasCityAndCountry && !hasCoordinates) {
    errors.push("provide either city/country or latitude/longitude");
  }

  if (hasCityAndCountry && hasCoordinates) {
    errors.push("provide either city/country or latitude/longitude, not both");
  }

  if (hasCoordinates) {
    let parsedLat: number | null = null;
    let parsedLon: number | null = null;

    try {
      parsedLat = parseCoordinate(latitude ?? "");
    } catch {
      errors.push("latitude has invalid format");
    }

    try {
      parsedLon = parseCoordinate(longitude ?? "");
    } catch {
      errors.push("longitude has invalid format");
    }

    if (parsedLat !== null && (parsedLat < -90 || parsedLat > 90)) {
      errors.push("latitude must be between -90 and 90");
    }

    if (parsedLon !== null && (parsedLon < -180 || parsedLon > 180)) {
      errors.push("longitude must be between -180 and 180");
    }
  }

  const theme = toOptionalTrimmedString(input.theme) ?? "terracotta";
  const allThemes = toBoolean(input.allThemes);
  const showMarker = input.showMarker === undefined ? false : toBoolean(input.showMarker);
  const markerColorInput = toOptionalTrimmedString(input.markerColor);
  const markerColor = markerColorInput ? normalizeHexColor(markerColorInput) : DEFAULT_MARKER_COLOR;
  if (markerColorInput && !markerColor) {
    errors.push("markerColor must be a hex value like #d62828");
  }

  const markerIcon = input.markerIcon === undefined ? "dot" : toMarkerIcon(input.markerIcon);
  if (input.markerIcon !== undefined && !markerIcon) {
    errors.push(`markerIcon must be one of: ${MARKER_ICONS.join(", ")}`);
  }

  const markerSize = input.markerSize === undefined ? "medium" : toMarkerSize(input.markerSize);
  if (input.markerSize !== undefined && !markerSize) {
    errors.push(`markerSize must be one of: ${MARKER_SIZES.join(", ")}`);
  }

  const distance = Math.max(100, Math.round(toNumber(input.distance, 18000)));
  const width = clampDimension(toNumber(input.width, 12));
  const height = clampDimension(toNumber(input.height, 16));

  const format = toFormat(input.format) ?? "png";

  if (!toFormat(input.format ?? format)) {
    if (input.format !== undefined) {
      errors.push(`format must be one of: ${SUPPORTED_FORMATS.join(", ")}`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      city: city ?? "Custom location",
      country: country ?? "Coordinates",
      latitude,
      longitude,
      showMarker,
      markerColor: markerColor ?? DEFAULT_MARKER_COLOR,
      markerIcon: markerIcon ?? "dot",
      markerSize: markerSize ?? "medium",
      countryLabel: toOptionalTrimmedString(input.countryLabel),
      theme,
      allThemes,
      distance,
      width,
      height,
      displayCity: toOptionalTrimmedString(input.displayCity),
      displayCountry: toOptionalTrimmedString(input.displayCountry),
      fontFamily: toOptionalTrimmedString(input.fontFamily),
      format
    }
  };
}
