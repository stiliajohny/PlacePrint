import path from "node:path";
import { tmpdir } from "node:os";

export const PROJECT_ROOT = process.cwd();
export const THEMES_DIR = path.join(PROJECT_ROOT, "themes");
export const PUBLIC_DIR = path.join(PROJECT_ROOT, "public");
export const PUBLIC_POSTERS_DIR = path.join(PUBLIC_DIR, "posters");

function runningInServerlessRuntime(): boolean {
  return Boolean(
    process.env.NETLIFY ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.LAMBDA_TASK_ROOT ||
      process.env.AWS_EXECUTION_ENV ||
      PROJECT_ROOT.startsWith("/var/task")
  );
}

function resolveWritablePath(input: string | undefined, fallback: string): string {
  const value = input?.trim();
  if (value) {
    if (path.isAbsolute(value)) {
      return value;
    }

    return runningInServerlessRuntime() ? path.join(tmpdir(), value) : path.join(PROJECT_ROOT, value);
  }

  if (runningInServerlessRuntime()) {
    return path.join(tmpdir(), fallback);
  }

  return path.join(PROJECT_ROOT, fallback);
}

export const POSTERS_DIR = resolveWritablePath(process.env.POSTERS_DIR, "posters");
export const GENERATED_TEMPLATES_SUBDIR = "templates";
export const GENERATED_TEMPLATES_DIR = path.join(POSTERS_DIR, GENERATED_TEMPLATES_SUBDIR);
export const GENERATED_TEMPLATES_PUBLIC_DIR = path.join(PUBLIC_POSTERS_DIR, GENERATED_TEMPLATES_SUBDIR);
export const CACHE_DIR = resolveWritablePath(process.env.CACHE_DIR, "cache");
export const FONTS_DIR = path.join(PROJECT_ROOT, "fonts");
export const FONT_CACHE_DIR = path.join(FONTS_DIR, "cache");

function toPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.round(parsed);
}

function parseUrlList(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export const NOMINATIM_SEARCH_URL =
  process.env.NOMINATIM_SEARCH_URL?.trim() || "https://nominatim.openstreetmap.org/search";

const DEFAULT_OVERPASS_API_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter"
];

const explicitOverpassUrl = process.env.OVERPASS_API_URL?.trim();
const configuredOverpassUrls = parseUrlList(process.env.OVERPASS_API_URLS);

export const OVERPASS_API_URLS =
  configuredOverpassUrls.length > 0
    ? configuredOverpassUrls
    : explicitOverpassUrl
      ? [explicitOverpassUrl]
      : DEFAULT_OVERPASS_API_URLS;
export const OVERPASS_API_URL = OVERPASS_API_URLS[0];

export const HTTP_TIMEOUT_MS = toPositiveInt(process.env.HTTP_TIMEOUT_MS, 45_000);
export const OVERPASS_MAX_RETRIES = toPositiveInt(process.env.OVERPASS_MAX_RETRIES, 3);
export const OVERPASS_RETRY_BASE_MS = toPositiveInt(process.env.OVERPASS_RETRY_BASE_MS, 800);
export const OVERPASS_QUERY_TIMEOUT_SECONDS = toPositiveInt(process.env.OVERPASS_QUERY_TIMEOUT_SECONDS, 60);
export const LOG_LEVEL = process.env.LOG_LEVEL?.trim() || "info";

export const MAX_DIMENSION_INCHES = 20;
export const DEFAULT_DPI = 300;
export const EARTH_RADIUS_METERS = 6_378_137;

export const SUPPORTED_FORMATS = ["png", "svg", "pdf"] as const;
export type SupportedFormat = (typeof SUPPORTED_FORMATS)[number];
