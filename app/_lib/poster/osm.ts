import {
  OVERPASS_API_URLS,
  OVERPASS_MAX_RETRIES,
  OVERPASS_QUERY_TIMEOUT_SECONDS,
  OVERPASS_RETRY_BASE_MS
} from "@/app/_lib/poster/constants";
import { cacheGetJson, cacheSetJson } from "@/app/_lib/poster/cache";
import { getBoundingBox } from "@/app/_lib/poster/geo";
import { fetchWithTimeout, sleep } from "@/app/_lib/poster/http";
import { logger } from "@/app/_lib/poster/logger";
import type { LatLon, LatLonPoint, PolygonRings, RoadFeature } from "@/app/_lib/poster/types";

type OverpassCoordinate = {
  lat: number;
  lon: number;
};

type OverpassRelationMember = {
  type: string;
  role?: string;
  ref: number;
  geometry?: OverpassCoordinate[];
};

type OverpassElement = {
  type: "way" | "relation" | "node";
  id: number;
  tags?: Record<string, string>;
  geometry?: OverpassCoordinate[];
  members?: OverpassRelationMember[];
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

let lastOverpassAtMs = 0;

async function respectOverpassRateLimit(): Promise<void> {
  const elapsed = Date.now() - lastOverpassAtMs;
  const wait = Math.max(0, 300 - elapsed);
  if (wait > 0) {
    await sleep(wait);
  }
  lastOverpassAtMs = Date.now();
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function retryDelay(attempt: number): number {
  return OVERPASS_RETRY_BASE_MS * (2 ** Math.max(0, attempt - 1));
}

function overpassQueryPrefix(): string {
  return `[out:json][timeout:${OVERPASS_QUERY_TIMEOUT_SECONDS}];`;
}

function toPointArray(coords: OverpassCoordinate[] | undefined): LatLonPoint[] {
  if (!coords || coords.length === 0) {
    return [];
  }

  return coords
    .filter((coord) => Number.isFinite(coord.lat) && Number.isFinite(coord.lon))
    .map((coord) => [coord.lat, coord.lon]);
}

function coordsEqual(a: LatLonPoint, b: LatLonPoint, epsilon = 1e-7): boolean {
  return Math.abs(a[0] - b[0]) < epsilon && Math.abs(a[1] - b[1]) < epsilon;
}

function closeRingIfNeeded(ring: LatLonPoint[]): LatLonPoint[] {
  if (ring.length < 3) {
    return ring;
  }

  // Do not force-close open geometry. We only normalize rings that are already closed.
  if (!coordsEqual(ring[0], ring[ring.length - 1])) {
    return ring;
  }

  const normalized = [...ring];
  normalized[normalized.length - 1] = normalized[0];
  return normalized;
}

function isClosedPolygon(ring: LatLonPoint[]): boolean {
  return ring.length >= 4 && coordsEqual(ring[0], ring[ring.length - 1]);
}

function stitchSegmentsToRings(segments: LatLonPoint[][]): LatLonPoint[][] {
  const remaining = segments
    .map((segment) => closeRingIfNeeded(segment))
    .filter((segment) => segment.length >= 2)
    .map((segment) => [...segment]);

  const rings: LatLonPoint[][] = [];

  while (remaining.length > 0) {
    const current = remaining.shift();
    if (!current) {
      break;
    }

    let ring = [...current];
    let changed = true;

    while (changed && !isClosedPolygon(ring)) {
      changed = false;
      const end = ring[ring.length - 1];

      for (let index = 0; index < remaining.length; index += 1) {
        const segment = remaining[index];
        const first = segment[0];
        const last = segment[segment.length - 1];

        if (coordsEqual(end, first)) {
          ring = [...ring, ...segment.slice(1)];
          remaining.splice(index, 1);
          changed = true;
          break;
        }

        if (coordsEqual(end, last)) {
          const reversed = [...segment].reverse();
          ring = [...ring, ...reversed.slice(1)];
          remaining.splice(index, 1);
          changed = true;
          break;
        }
      }
    }

    ring = closeRingIfNeeded(ring);
    if (isClosedPolygon(ring)) {
      rings.push(ring);
    }
  }

  return rings;
}

function isPointInsideRing(point: LatLonPoint, ring: LatLonPoint[]): boolean {
  let inside = false;

  const px = point[1];
  const py = point[0];

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const ix = ring[i][1];
    const iy = ring[i][0];
    const jx = ring[j][1];
    const jy = ring[j][0];

    const intersects = iy > py !== jy > py && px < ((jx - ix) * (py - iy)) / (jy - iy + 1e-12) + ix;
    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function relationToPolygons(element: OverpassElement): PolygonRings[] {
  if (!element.members || element.members.length === 0) {
    return [];
  }

  const outerSegments: LatLonPoint[][] = [];
  const innerSegments: LatLonPoint[][] = [];

  for (const member of element.members) {
    if (member.type !== "way") {
      continue;
    }

    const points = toPointArray(member.geometry);
    if (points.length < 2) {
      continue;
    }

    if (member.role === "inner") {
      innerSegments.push(points);
    } else {
      outerSegments.push(points);
    }
  }

  const outerRings = stitchSegmentsToRings(outerSegments);
  const innerRings = stitchSegmentsToRings(innerSegments);

  const polygons: PolygonRings[] = [];
  for (const outer of outerRings) {
    const rings = [outer];

    for (const inner of innerRings) {
      const probe = inner[0];
      if (probe && isPointInsideRing(probe, outer)) {
        rings.push(inner);
      }
    }

    polygons.push({ rings });
  }

  return polygons;
}

async function fetchOverpass(query: string, cacheKey: string): Promise<OverpassElement[]> {
  const cached = await cacheGetJson<OverpassResponse>(cacheKey);
  if (cached?.elements && Array.isArray(cached.elements)) {
    logger.debug("Overpass cache hit", { cacheKey, elements: cached.elements.length });
    return cached.elements;
  }

  const endpoints = OVERPASS_API_URLS.length > 0 ? OVERPASS_API_URLS : [];
  const maxAttempts = Math.max(1, OVERPASS_MAX_RETRIES);
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    for (const endpoint of endpoints) {
      await respectOverpassRateLimit();

      logger.debug("Overpass request attempt", {
        cacheKey,
        endpoint,
        attempt,
        maxAttempts,
        queryLength: query.length
      });

      try {
        const response = await fetchWithTimeout(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain",
            "User-Agent": process.env.OSM_USER_AGENT?.trim() || "city_map_poster_js"
          },
          body: query
        });

        if (!response.ok) {
          const message = `Overpass request failed: HTTP ${response.status}`;
          if (!isRetryableStatus(response.status)) {
            throw new Error(`${message} (${endpoint})`);
          }

          lastError = new Error(`${message} (${endpoint})`);
          logger.warn("Retryable Overpass status", {
            endpoint,
            status: response.status,
            attempt,
            maxAttempts
          });
          continue;
        }

        const json = (await response.json()) as OverpassResponse;
        await cacheSetJson(cacheKey, json);
        logger.debug("Overpass request succeeded", {
          cacheKey,
          endpoint,
          attempt,
          elements: json.elements?.length ?? 0
        });

        return json.elements ?? [];
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        lastError = error instanceof Error ? error : new Error(message);
        logger.warn("Overpass request error", {
          endpoint,
          attempt,
          maxAttempts,
          error: message
        });
      }
    }

    if (attempt < maxAttempts) {
      const delayMs = retryDelay(attempt);
      logger.info("Retrying Overpass after backoff", { attempt, maxAttempts, delayMs });
      await sleep(delayMs);
    }
  }

  const suffix = lastError ? ` Last error: ${lastError.message}` : "";
  throw new Error(`Overpass request failed after ${maxAttempts} attempts.${suffix}`);
}

function normalizeHighwayTag(raw: string | undefined): string {
  if (!raw) {
    return "unclassified";
  }

  return raw.split(";")[0]?.trim() || "unclassified";
}

export async function fetchRoads(center: LatLon, distMeters: number): Promise<RoadFeature[]> {
  const bbox = getBoundingBox(center, distMeters);
  const cacheKey = `graph_${center.lat.toFixed(6)}_${center.lon.toFixed(6)}_${distMeters.toFixed(2)}`;

  logger.debug("Fetching roads from Overpass", { center, distMeters, bbox, cacheKey });
  const query = [
    overpassQueryPrefix(),
    "(",
    `  way(${bbox.south},${bbox.west},${bbox.north},${bbox.east})[\"highway\"];`,
    ");",
    "out geom;"
  ].join("\n");

  const elements = await fetchOverpass(query, cacheKey);
  const roads: RoadFeature[] = [];

  for (const element of elements) {
    if (element.type !== "way") {
      continue;
    }

    const points = toPointArray(element.geometry);
    if (points.length < 2) {
      continue;
    }

    roads.push({
      highway: normalizeHighwayTag(element.tags?.highway),
      points
    });
  }

  return roads;
}

export async function fetchWaterPolygons(center: LatLon, distMeters: number): Promise<PolygonRings[]> {
  const bbox = getBoundingBox(center, distMeters);
  const cacheKey = `water_${center.lat.toFixed(6)}_${center.lon.toFixed(6)}_${distMeters.toFixed(2)}`;

  logger.debug("Fetching water polygons from Overpass", { center, distMeters, bbox, cacheKey });
  const query = [
    overpassQueryPrefix(),
    "(",
    `  way(${bbox.south},${bbox.west},${bbox.north},${bbox.east})[\"natural\"~\"water|bay|strait\"];`,
    `  relation(${bbox.south},${bbox.west},${bbox.north},${bbox.east})[\"natural\"~\"water|bay|strait\"];`,
    `  way(${bbox.south},${bbox.west},${bbox.north},${bbox.east})[\"waterway\"=\"riverbank\"];`,
    `  relation(${bbox.south},${bbox.west},${bbox.north},${bbox.east})[\"waterway\"=\"riverbank\"];`,
    ");",
    "out geom;"
  ].join("\n");

  return fetchPolygons(query, cacheKey);
}

export async function fetchParkPolygons(center: LatLon, distMeters: number): Promise<PolygonRings[]> {
  const bbox = getBoundingBox(center, distMeters);
  const cacheKey = `parks_${center.lat.toFixed(6)}_${center.lon.toFixed(6)}_${distMeters.toFixed(2)}`;

  logger.debug("Fetching parks polygons from Overpass", { center, distMeters, bbox, cacheKey });
  const query = [
    overpassQueryPrefix(),
    "(",
    `  way(${bbox.south},${bbox.west},${bbox.north},${bbox.east})[\"leisure\"=\"park\"];`,
    `  relation(${bbox.south},${bbox.west},${bbox.north},${bbox.east})[\"leisure\"=\"park\"];`,
    `  way(${bbox.south},${bbox.west},${bbox.north},${bbox.east})[\"landuse\"=\"grass\"];`,
    `  relation(${bbox.south},${bbox.west},${bbox.north},${bbox.east})[\"landuse\"=\"grass\"];`,
    ");",
    "out geom;"
  ].join("\n");

  return fetchPolygons(query, cacheKey);
}

async function fetchPolygons(query: string, cacheKey: string): Promise<PolygonRings[]> {
  const elements = await fetchOverpass(query, cacheKey);
  const polygons: PolygonRings[] = [];

  for (const element of elements) {
    if (element.type === "way") {
      const wayPoints = closeRingIfNeeded(toPointArray(element.geometry));
      if (isClosedPolygon(wayPoints)) {
        polygons.push({ rings: [wayPoints] });
      }
      continue;
    }

    if (element.type === "relation") {
      polygons.push(...relationToPolygons(element));
    }
  }

  return polygons;
}
