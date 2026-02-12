import { promises as fs } from "node:fs";
import path from "node:path";

import { DEFAULT_DPI, IS_SERVERLESS_RUNTIME, POSTERS_DIR } from "@/app/_lib/poster/constants";
import { ensurePosterDirs } from "@/app/_lib/poster/cache";
import {
  buildLocalProjection,
  formatCoordinatesLabel,
  getCropLimits,
  isLatinScript,
  parseCoordinate,
  projectPoint,
  slugifyCity,
  toPixelPoint
} from "@/app/_lib/poster/geo";
import { loadFonts } from "@/app/_lib/poster/fonts";
import { logger } from "@/app/_lib/poster/logger";
import { getCoordinates } from "@/app/_lib/poster/nominatim";
import { fetchParkPolygons, fetchRoads, fetchWaterPolygons } from "@/app/_lib/poster/osm";
import { sceneSvgToPng, sceneToPdf, sceneToSvg, sceneToSvgWithOptions } from "@/app/_lib/poster/render";
import { loadTheme, readAvailableThemes } from "@/app/_lib/poster/themes";
import type {
  LatLon,
  LocalProjection,
  PolygonRings,
  PosterOutput,
  PosterRequest,
  PosterScene,
  ProjectedPoint,
  ProjectedPolygonRings,
  ProjectedRoadFeature,
  RoadFeature
} from "@/app/_lib/poster/types";

type OutputUrlMode = "api" | "static";

type GeneratePosterOptions = {
  outputSubdir?: string;
  outputRootDir?: string;
  outputUrlMode?: OutputUrlMode;
};

const SERVERLESS_MAX_COMPENSATED_DISTANCE_METERS = Number.parseFloat(
  process.env.SERVERLESS_MAX_COMPENSATED_DISTANCE_METERS?.trim() || "5000"
);
const SERVERLESS_MAX_ROAD_FEATURES = Number.parseInt(process.env.SERVERLESS_MAX_ROAD_FEATURES?.trim() || "14000", 10);
const SERVERLESS_MAX_ROAD_POINTS = Number.parseInt(process.env.SERVERLESS_MAX_ROAD_POINTS?.trim() || "28", 10);
const SERVERLESS_MAX_WATER_POLYGONS = Number.parseInt(
  process.env.SERVERLESS_MAX_WATER_POLYGONS?.trim() || "650",
  10
);
const SERVERLESS_MAX_PARK_POLYGONS = Number.parseInt(process.env.SERVERLESS_MAX_PARK_POLYGONS?.trim() || "900", 10);
const SERVERLESS_MAX_RING_POINTS = Number.parseInt(process.env.SERVERLESS_MAX_RING_POINTS?.trim() || "120", 10);

function normalizeOutputSubdir(input: string | undefined): string {
  const value = input?.trim();
  if (!value) {
    return "";
  }

  const normalized = path.posix.normalize(value.replaceAll("\\", "/"));
  if (!normalized || normalized === ".") {
    return "";
  }

  if (normalized.startsWith("/") || normalized === ".." || normalized.startsWith("../")) {
    throw new Error("Invalid output subdirectory");
  }

  return normalized;
}

function buildRelativeOutputPath(fileName: string, outputSubdir: string): string {
  return outputSubdir
    ? path.posix.join("posters", outputSubdir, fileName)
    : path.posix.join("posters", fileName);
}

function resolveOutputRootDir(input: string | undefined): string {
  const value = input?.trim();
  if (!value) {
    return POSTERS_DIR;
  }

  return path.isAbsolute(value) ? value : path.join(process.cwd(), value);
}

function normalizeOutputUrlMode(input: OutputUrlMode | undefined): OutputUrlMode {
  return input === "static" ? "static" : "api";
}

function getDisplayPoint(input: PosterRequest): LatLon {
  if (!input.latitude || !input.longitude) {
    throw new Error("Missing latitude/longitude overrides");
  }

  return {
    lat: parseCoordinate(input.latitude),
    lon: parseCoordinate(input.longitude)
  };
}

function generateOutputFilename(city: string, themeName: string, format: string): string {
  const timestamp = new Date()
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace("T", "_")
    .slice(0, 15);

  const citySlug = slugifyCity(city) || "city";
  return `${citySlug}_${themeName}_${timestamp}.${format}`;
}

function projectRoads(
  roads: RoadFeature[],
  projection: LocalProjection,
  widthPx: number,
  heightPx: number,
  limits: { minX: number; maxX: number; minY: number; maxY: number }
): ProjectedRoadFeature[] {
  return roads
    .map((road) => {
      const points = road.points
        .map(([lat, lon]) => projectPoint({ lat, lon }, projection))
        .map((point) => toPixelPoint(point, widthPx, heightPx, limits));

      return {
        highway: road.highway,
        points
      };
    })
    .filter((road) => road.points.length >= 2);
}

function projectPolygons(
  polygons: PolygonRings[],
  projection: LocalProjection,
  widthPx: number,
  heightPx: number,
  limits: { minX: number; maxX: number; minY: number; maxY: number }
): ProjectedPolygonRings[] {
  return polygons
    .map((polygon) => ({
      rings: polygon.rings
        .map((ring) =>
          ring
            .map(([lat, lon]) => projectPoint({ lat, lon }, projection))
            .map((point) => toPixelPoint(point, widthPx, heightPx, limits))
        )
        .filter((ring) => ring.length >= 4)
    }))
    .filter((polygon) => polygon.rings.length > 0);
}

function createScene(params: {
  request: PosterRequest;
  point: LatLon;
  marker: ProjectedPoint | null;
  roads: ProjectedRoadFeature[];
  water: ProjectedPolygonRings[];
  parks: ProjectedPolygonRings[];
  themeName: string;
  theme: Awaited<ReturnType<typeof loadTheme>>;
  fonts: Awaited<ReturnType<typeof loadFonts>>;
}): PosterScene {
  const { request, point, marker, roads, water, parks, theme, fonts } = params;

  const widthPx = Math.max(1, Math.round(request.width * DEFAULT_DPI));
  const heightPx = Math.max(1, Math.round(request.height * DEFAULT_DPI));
  const scaleFactor = Math.min(request.width, request.height) / 12;
  const pointsToPixels = DEFAULT_DPI / 72;

  const displayCity = request.displayCity || request.city;
  const displayCountry = request.displayCountry || request.countryLabel || request.country;

  const spacedCity = isLatinScript(displayCity)
    ? displayCity
        .toUpperCase()
        .split("")
        .join("  ")
    : displayCity;

  const baseMainPt = 60 * scaleFactor;
  const fontSizeMainPt = baseMainPt;

  const fontFamilyMain = fonts?.bold.family || "Helvetica";
  const fontFamilySub = fonts?.light.family || "Helvetica";
  const fontFamilyCoords = fonts?.regular.family || "Helvetica";
  const fontFamilyAttr = fonts?.light.family || "Helvetica";

  // Matplotlib sizes are defined in points. Convert to pixels for the JS renderers.
  let fontSizeMainPx = fontSizeMainPt * pointsToPixels;
  let fontSizeSubPx = 22 * scaleFactor * pointsToPixels;
  const fontSizeCoordsPx = 14 * scaleFactor * pointsToPixels;
  const fontSizeAttrPx = 8 * scaleFactor * pointsToPixels;

  const fitTextSize = (text: string, currentSizePx: number, minSizePx: number, maxWidthPx: number): number => {
    const estimatedWidth = text.length * currentSizePx * 0.62;
    if (estimatedWidth <= maxWidthPx || estimatedWidth <= 0) {
      return currentSizePx;
    }

    // Keep a small safety margin so renderer/font differences do not clip trailing glyphs.
    const fittedSize = currentSizePx * (maxWidthPx / estimatedWidth) * 0.95;
    return Math.max(minSizePx, fittedSize);
  };

  fontSizeMainPx = fitTextSize(
    spacedCity,
    fontSizeMainPx,
    10 * scaleFactor * pointsToPixels,
    widthPx * 0.88
  );
  fontSizeSubPx = fitTextSize(
    displayCountry.toUpperCase(),
    fontSizeSubPx,
    8 * scaleFactor * pointsToPixels,
    widthPx * 0.92
  );

  return {
    widthPx,
    heightPx,
    theme,
    marker,
    markerColor: request.markerColor,
    markerIcon: request.markerIcon,
    markerSize: request.markerSize,
    water,
    parks,
    roads,
    mainTitle: spacedCity,
    countryTitle: displayCountry.toUpperCase(),
    coordinatesLabel: formatCoordinatesLabel(point),
    scaleFactor,
    fontFamilyMain,
    fontFamilySub,
    fontFamilyCoords,
    fontFamilyAttr,
    fontSizeMain: fontSizeMainPx,
    fontSizeSub: fontSizeSubPx,
    fontSizeCoords: fontSizeCoordsPx,
    fontSizeAttr: fontSizeAttrPx
  };
}

function toPosterOutput(relativePath: string, outputUrlMode: OutputUrlMode): PosterOutput {
  const fileName = path.basename(relativePath);
  const format = path.extname(relativePath).replace(".", "").toLowerCase();
  const downloadUrl =
    outputUrlMode === "static"
      ? `/${relativePath}`
      : `/api/posters/file?path=${encodeURIComponent(relativePath)}`;

  return {
    relativePath,
    fileName,
    format,
    downloadUrl,
    previewUrl: format === "png" ? downloadUrl : null
  };
}

function overpassCompensatedDistance(request: PosterRequest): number {
  // Match the Python generator behavior.
  return (request.distance * (Math.max(request.height, request.width) / Math.min(request.height, request.width))) / 4;
}

function clampCount(input: number, fallback: number): number {
  if (!Number.isFinite(input) || input < 1) {
    return fallback;
  }

  return Math.max(1, Math.round(input));
}

function roadPriority(highway: string): number {
  if (highway === "motorway" || highway === "motorway_link") {
    return 0;
  }

  if (["trunk", "trunk_link", "primary", "primary_link"].includes(highway)) {
    return 1;
  }

  if (["secondary", "secondary_link"].includes(highway)) {
    return 2;
  }

  if (["tertiary", "tertiary_link"].includes(highway)) {
    return 3;
  }

  if (highway === "residential") {
    return 4;
  }

  if (["unclassified", "service", "living_street"].includes(highway)) {
    return 5;
  }

  return 6;
}

function downsamplePoints<T>(points: T[], maxPoints: number): T[] {
  if (points.length <= maxPoints) {
    return points;
  }

  if (maxPoints <= 2) {
    return [points[0], points[points.length - 1]];
  }

  const sampled: T[] = [points[0]];
  const availableInterior = points.length - 2;
  const targetInterior = maxPoints - 2;
  const step = Math.ceil(availableInterior / targetInterior);

  for (let index = 1; index < points.length - 1; index += step) {
    sampled.push(points[index]);
  }

  sampled.push(points[points.length - 1]);

  return sampled.length > maxPoints ? sampled.slice(0, maxPoints - 1).concat(points[points.length - 1]) : sampled;
}

function optimizeRoadFeatures(roads: RoadFeature[]): RoadFeature[] {
  if (!IS_SERVERLESS_RUNTIME) {
    return roads;
  }

  const maxRoadFeatures = clampCount(SERVERLESS_MAX_ROAD_FEATURES, 14000);
  const maxRoadPoints = clampCount(SERVERLESS_MAX_ROAD_POINTS, 28);

  const ranked = [...roads].sort((a, b) => {
    const priorityDiff = roadPriority(a.highway) - roadPriority(b.highway);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return b.points.length - a.points.length;
  });

  return ranked.slice(0, maxRoadFeatures).map((road) => ({
    ...road,
    points: downsamplePoints(road.points, maxRoadPoints)
  }));
}

function optimizePolygons(polygons: PolygonRings[], maxPolygonCount: number, maxRingPoints: number): PolygonRings[] {
  if (!IS_SERVERLESS_RUNTIME) {
    return polygons;
  }

  const cappedPolygonCount = clampCount(maxPolygonCount, 700);
  const cappedRingPoints = clampCount(maxRingPoints, 120);

  const ranked = [...polygons].sort((a, b) => (b.rings[0]?.length ?? 0) - (a.rings[0]?.length ?? 0));

  return ranked.slice(0, cappedPolygonCount).map((polygon) => ({
    rings: polygon.rings.map((ring) => downsamplePoints(ring, cappedRingPoints))
  }));
}

export async function generatePosterViaJs(input: PosterRequest): Promise<{
  outputs: PosterOutput[];
  stdout: string;
  stderr: string;
}> {
  return generatePosterViaJsWithOptions(input, {});
}

export async function generatePosterViaJsWithOptions(
  input: PosterRequest,
  options: GeneratePosterOptions
): Promise<{
  outputs: PosterOutput[];
  stdout: string;
  stderr: string;
}> {
  const outputSubdir = normalizeOutputSubdir(options.outputSubdir);
  const outputRootDir = resolveOutputRootDir(options.outputRootDir);
  const outputUrlMode = normalizeOutputUrlMode(options.outputUrlMode);
  const outputDir = outputSubdir ? path.join(outputRootDir, outputSubdir) : outputRootDir;

  await ensurePosterDirs([outputDir]);

  const logs: string[] = [];
  logger.info("Poster generation started", {
    city: input.city,
    country: input.country,
    theme: input.theme,
    allThemes: input.allThemes,
    format: input.format,
    distance: input.distance,
    width: input.width,
    height: input.height
  });

  const point =
    input.latitude && input.longitude
      ? getDisplayPoint(input)
      : await getCoordinates(input.city, input.country);

  logs.push(`Coordinates: ${point.lat.toFixed(6)}, ${point.lon.toFixed(6)}`);

  const requestedCompensatedDist = overpassCompensatedDistance(input);
  const compensatedDist =
    IS_SERVERLESS_RUNTIME && Number.isFinite(SERVERLESS_MAX_COMPENSATED_DISTANCE_METERS)
      ? Math.min(requestedCompensatedDist, Math.max(500, SERVERLESS_MAX_COMPENSATED_DISTANCE_METERS))
      : requestedCompensatedDist;

  logs.push(`Compensated distance: ${compensatedDist.toFixed(2)}m`);
  if (compensatedDist < requestedCompensatedDist) {
    logs.push(
      `Compensated distance was capped from ${requestedCompensatedDist.toFixed(2)}m to ${compensatedDist.toFixed(2)}m for serverless runtime stability.`
    );
  }

  const [overpassResults, themes, fonts] = await Promise.all([
    Promise.allSettled([
      fetchRoads(point, compensatedDist),
      fetchWaterPolygons(point, compensatedDist),
      fetchParkPolygons(point, compensatedDist)
    ]),
    readAvailableThemes(),
    loadFonts(input.fontFamily)
  ]);

  const [roadsResult, waterResult, parksResult] = overpassResults;
  const roadsRaw =
    roadsResult.status === "fulfilled"
      ? roadsResult.value
      : [];
  const waterRaw =
    waterResult.status === "fulfilled"
      ? waterResult.value
      : [];
  const parksRaw =
    parksResult.status === "fulfilled"
      ? parksResult.value
      : [];

  if (roadsResult.status === "rejected") {
    const message = roadsResult.reason instanceof Error ? roadsResult.reason.message : String(roadsResult.reason);
    logger.warn("Road fetch failed; generating poster without roads", { error: message });
    logs.push(`Road fetch failed. Continuing without roads. Error: ${message}`);
  }

  if (waterResult.status === "rejected") {
    const message = waterResult.reason instanceof Error ? waterResult.reason.message : String(waterResult.reason);
    logger.warn("Water fetch failed; generating poster without water polygons", { error: message });
    logs.push(`Water fetch failed. Continuing without water polygons. Error: ${message}`);
  }

  if (parksResult.status === "rejected") {
    const message = parksResult.reason instanceof Error ? parksResult.reason.message : String(parksResult.reason);
    logger.warn("Park fetch failed; generating poster without park polygons", { error: message });
    logs.push(`Park fetch failed. Continuing without park polygons. Error: ${message}`);
  }

  if (
    roadsResult.status === "rejected" &&
    waterResult.status === "rejected" &&
    parksResult.status === "rejected"
  ) {
    throw new Error("All Overpass layers failed within the serverless time budget. Please retry.");
  }

  const roads = optimizeRoadFeatures(roadsRaw);
  const water = optimizePolygons(waterRaw, SERVERLESS_MAX_WATER_POLYGONS, SERVERLESS_MAX_RING_POINTS);
  const parks = optimizePolygons(parksRaw, SERVERLESS_MAX_PARK_POLYGONS, SERVERLESS_MAX_RING_POINTS);

  logs.push(`Roads: ${roadsRaw.length}, water polygons: ${waterRaw.length}, parks polygons: ${parksRaw.length}`);
  if (IS_SERVERLESS_RUNTIME) {
    logs.push(
      `Optimized for serverless: roads ${roads.length}/${roadsRaw.length}, water ${water.length}/${waterRaw.length}, parks ${parks.length}/${parksRaw.length}.`
    );
  }

  logger.debug("Poster data fetched", {
    roads: roadsRaw.length,
    waterPolygons: waterRaw.length,
    parkPolygons: parksRaw.length
  });

  const themeIds = themes.map((theme) => theme.id);
  const themesToGenerate = input.allThemes ? themeIds : [input.theme];

  const projection = buildLocalProjection(point);
  const projectedCenter = projectPoint(point, projection);
  const widthPx = Math.max(1, Math.round(input.width * DEFAULT_DPI));
  const heightPx = Math.max(1, Math.round(input.height * DEFAULT_DPI));
  const limits = getCropLimits(compensatedDist, input.width, input.height, projectedCenter);
  const marker = input.showMarker
    ? toPixelPoint(projectedCenter, widthPx, heightPx, limits)
    : null;

  const projectedRoads = projectRoads(roads, projection, widthPx, heightPx, limits);
  const projectedWater = projectPolygons(water, projection, widthPx, heightPx, limits);
  const projectedParks = projectPolygons(parks, projection, widthPx, heightPx, limits);

  const outputs: PosterOutput[] = [];

  for (const themeName of themesToGenerate) {
    const theme = await loadTheme(themeName);
    const scene = createScene({
      request: input,
      point,
      marker,
      roads: projectedRoads,
      water: projectedWater,
      parks: projectedParks,
      themeName,
      theme,
      fonts
    });

    const svg = input.format === "png" ? sceneToSvgWithOptions(scene, fonts, { includeLabels: false }) : sceneToSvg(scene, fonts);

    let fileBuffer: Buffer;
    if (input.format === "png") {
      fileBuffer = await sceneSvgToPng(svg, scene, fonts);
    } else if (input.format === "pdf") {
      fileBuffer = sceneToPdf(scene);
    } else {
      fileBuffer = Buffer.from(svg, "utf8");
    }

    const fileName = generateOutputFilename(input.city, themeName, input.format);
    const absolutePath = path.join(outputDir, fileName);
    await fs.writeFile(absolutePath, fileBuffer);

    const relativePath = buildRelativeOutputPath(fileName, outputSubdir);
    outputs.push(toPosterOutput(relativePath, outputUrlMode));

    logs.push(`Saved: ${relativePath}`);
    logger.info("Poster saved", { relativePath, format: input.format, themeName });
  }

  logger.info("Poster generation completed", { outputs: outputs.length });

  return {
    outputs,
    stdout: logs.join("\n"),
    stderr: ""
  };
}
