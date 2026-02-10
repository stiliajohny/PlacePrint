import { EARTH_RADIUS_METERS } from "@/app/_lib/poster/constants";
import type { LatLon, LocalProjection, ProjectedPoint } from "@/app/_lib/poster/types";

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

function normalizeCardinalSign(cardinal: string | undefined): number {
  if (!cardinal) {
    return 1;
  }

  const upper = cardinal.toUpperCase();
  if (upper === "S" || upper === "W") {
    return -1;
  }

  return 1;
}

export function parseCoordinate(value: string): number {
  const input = value.trim();
  if (!input) {
    throw new Error("Coordinate value is empty");
  }

  const simple = Number(input);
  if (Number.isFinite(simple)) {
    return simple;
  }

  const dmsMatch = input
    .replace(/[″”]/g, '"')
    .replace(/[′’]/g, "'")
    .match(
      /^\s*([+-]?\d+(?:\.\d+)?)\s*(?:[°\s]\s*(\d+(?:\.\d+)?))?\s*(?:['\s]\s*(\d+(?:\.\d+)?))?\s*(?:["\s])?\s*([NSEW])?\s*$/i
    );

  if (!dmsMatch) {
    throw new Error(`Invalid coordinate format: ${value}`);
  }

  const deg = Number(dmsMatch[1]);
  const min = dmsMatch[2] ? Number(dmsMatch[2]) : 0;
  const sec = dmsMatch[3] ? Number(dmsMatch[3]) : 0;
  const cardinal = dmsMatch[4];

  const base = Math.abs(deg) + min / 60 + sec / 3600;
  const signFromDeg = deg < 0 ? -1 : 1;
  const signFromCardinal = normalizeCardinalSign(cardinal);
  const sign = cardinal ? signFromCardinal : signFromDeg;

  return base * sign;
}

export function isLatinScript(text: string): boolean {
  if (!text) {
    return true;
  }

  let latinCount = 0;
  let totalAlpha = 0;

  for (const char of text) {
    if (/\p{L}/u.test(char)) {
      totalAlpha += 1;
      if (char.codePointAt(0) && char.codePointAt(0)! < 0x250) {
        latinCount += 1;
      }
    }
  }

  if (totalAlpha === 0) {
    return true;
  }

  return latinCount / totalAlpha > 0.8;
}

export function slugifyCity(city: string): string {
  return city
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function buildLocalProjection(center: LatLon): LocalProjection {
  const centerLatRad = center.lat * DEG_TO_RAD;
  const centerLonRad = center.lon * DEG_TO_RAD;

  const centerSinLat = Math.sin(centerLatRad);
  const centerCosLat = Math.cos(centerLatRad);
  const centerSinLon = Math.sin(centerLonRad);
  const centerCosLon = Math.cos(centerLonRad);

  const centerEcefX = EARTH_RADIUS_METERS * centerCosLat * centerCosLon;
  const centerEcefY = EARTH_RADIUS_METERS * centerCosLat * centerSinLon;
  const centerEcefZ = EARTH_RADIUS_METERS * centerSinLat;

  return {
    centerLat: center.lat,
    centerLon: center.lon,
    centerSinLat,
    centerCosLat,
    centerSinLon,
    centerCosLon,
    centerEcefX,
    centerEcefY,
    centerEcefZ
  };
}

export function projectPoint(point: LatLon, projection: LocalProjection): ProjectedPoint {
  const latRad = point.lat * DEG_TO_RAD;
  const lonRad = point.lon * DEG_TO_RAD;

  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinLon = Math.sin(lonRad);
  const cosLon = Math.cos(lonRad);

  const ecefX = EARTH_RADIUS_METERS * cosLat * cosLon;
  const ecefY = EARTH_RADIUS_METERS * cosLat * sinLon;
  const ecefZ = EARTH_RADIUS_METERS * sinLat;

  const dx = ecefX - projection.centerEcefX;
  const dy = ecefY - projection.centerEcefY;
  const dz = ecefZ - projection.centerEcefZ;

  // Local ENU frame centered at the map center.
  const east = -projection.centerSinLon * dx + projection.centerCosLon * dy;
  const north =
    -projection.centerSinLat * projection.centerCosLon * dx -
    projection.centerSinLat * projection.centerSinLon * dy +
    projection.centerCosLat * dz;

  return {
    x: east,
    y: north
  };
}

export function getBoundingBox(center: LatLon, distMeters: number): {
  south: number;
  west: number;
  north: number;
  east: number;
} {
  const latDelta = (distMeters / EARTH_RADIUS_METERS) * RAD_TO_DEG;
  const cosLat = Math.max(1e-6, Math.abs(Math.cos(center.lat * DEG_TO_RAD)));
  const lonDelta = (distMeters / (EARTH_RADIUS_METERS * cosLat)) * RAD_TO_DEG;

  const south = Math.max(-90, center.lat - latDelta);
  const north = Math.min(90, center.lat + latDelta);
  const west = Math.max(-180, center.lon - lonDelta);
  const east = Math.min(180, center.lon + lonDelta);

  return {
    south,
    west,
    north,
    east
  };
}

export function getCropLimits(
  distMeters: number,
  widthInches: number,
  heightInches: number,
  center: ProjectedPoint = { x: 0, y: 0 }
): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  const aspect = widthInches / heightInches;

  let halfX = distMeters;
  let halfY = distMeters;

  if (aspect > 1) {
    halfY = halfX / aspect;
  } else {
    halfX = halfY * aspect;
  }

  return {
    minX: center.x - halfX,
    maxX: center.x + halfX,
    minY: center.y - halfY,
    maxY: center.y + halfY
  };
}

export function toPixelPoint(
  point: ProjectedPoint,
  widthPx: number,
  heightPx: number,
  limits: { minX: number; maxX: number; minY: number; maxY: number }
): ProjectedPoint {
  const xRatio = (point.x - limits.minX) / (limits.maxX - limits.minX);
  const yRatio = (point.y - limits.minY) / (limits.maxY - limits.minY);

  return {
    x: xRatio * widthPx,
    y: heightPx - yRatio * heightPx
  };
}

export function formatCoordinatesLabel(point: LatLon): string {
  const latLabel =
    point.lat >= 0 ? `${point.lat.toFixed(4)}\u00b0 N` : `${Math.abs(point.lat).toFixed(4)}\u00b0 S`;
  const lonLabel =
    point.lon >= 0 ? `${point.lon.toFixed(4)}\u00b0 E` : `${Math.abs(point.lon).toFixed(4)}\u00b0 W`;
  return `${latLabel} / ${lonLabel}`;
}
