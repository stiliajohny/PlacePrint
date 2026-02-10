import { NOMINATIM_SEARCH_URL } from "@/app/_lib/poster/constants";
import { cacheGetJson, cacheSetJson } from "@/app/_lib/poster/cache";
import { fetchWithTimeout, sleep } from "@/app/_lib/poster/http";
import { logger } from "@/app/_lib/poster/logger";
import type { LatLon } from "@/app/_lib/poster/types";

type NominatimResult = {
  lat: string;
  lon: string;
  display_name?: string;
};

let lastGeocodeAtMs = 0;

async function respectNominatimRateLimit(): Promise<void> {
  const elapsed = Date.now() - lastGeocodeAtMs;
  const wait = Math.max(0, 1000 - elapsed);
  if (wait > 0) {
    await sleep(wait);
  }
  lastGeocodeAtMs = Date.now();
}

async function searchNominatim(params: URLSearchParams, city: string, country: string): Promise<NominatimResult[]> {
  const response = await fetchWithTimeout(`${NOMINATIM_SEARCH_URL}?${params.toString()}`, {
    headers: {
      "User-Agent": process.env.OSM_USER_AGENT?.trim() || "city_map_poster_js",
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    logger.warn("Nominatim request failed", { city, country, status: response.status, query: params.toString() });
    throw new Error(`Geocoding failed: HTTP ${response.status}`);
  }

  return (await response.json()) as NominatimResult[];
}

export async function getCoordinates(city: string, country: string): Promise<LatLon> {
  const key = `coords_v3_${city.toLowerCase()}_${country.toLowerCase()}`;
  const cached = await cacheGetJson<LatLon>(key);
  if (cached) {
    logger.debug("Nominatim cache hit", { city, country, key });
    return cached;
  }

  await respectNominatimRateLimit();

  // Match Python geopy usage: a single free-form query "city, country".
  const qParams = new URLSearchParams({
    q: `${city}, ${country}`,
    format: "jsonv2",
    limit: "1"
  });

  let results = await searchNominatim(qParams, city, country);
  if (results.length === 0) {
    const fallbackParams = new URLSearchParams({
      city,
      country,
      format: "jsonv2",
      limit: "1"
    });
    results = await searchNominatim(fallbackParams, city, country);
  }

  const first = results[0];

  if (!first) {
    throw new Error(`Could not find coordinates for ${city}, ${country}`);
  }

  const parsedLat = Number(first.lat);
  const parsedLon = Number(first.lon);

  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLon)) {
    throw new Error(`Geocoder returned invalid coordinates for ${city}, ${country}`);
  }

  const point = { lat: parsedLat, lon: parsedLon };
  await cacheSetJson(key, point);
  logger.debug("Nominatim resolved city/country", { city, country, point });
  return point;
}
