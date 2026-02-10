import { promises as fs } from "node:fs";
import path from "node:path";

import { DEFAULT_DPI, POSTERS_DIR } from "@/app/_lib/poster/constants";
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

type GeneratePosterOptions = {
  outputSubdir?: string;
};

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

function toPosterOutput(relativePath: string): PosterOutput {
  const fileName = path.basename(relativePath);
  const format = path.extname(relativePath).replace(".", "").toLowerCase();
  const encodedPath = encodeURIComponent(relativePath);
  const downloadUrl = `/api/posters/file?path=${encodedPath}`;

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
  const outputDir = outputSubdir ? path.join(POSTERS_DIR, outputSubdir) : POSTERS_DIR;

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

  const compensatedDist = overpassCompensatedDistance(input);
  logs.push(`Compensated distance: ${compensatedDist.toFixed(2)}m`);

  const [roadsRaw, waterRaw, parksRaw, themes, fonts] = await Promise.all([
    fetchRoads(point, compensatedDist),
    fetchWaterPolygons(point, compensatedDist),
    fetchParkPolygons(point, compensatedDist),
    readAvailableThemes(),
    loadFonts(input.fontFamily)
  ]);

  logs.push(`Roads: ${roadsRaw.length}, water polygons: ${waterRaw.length}, parks polygons: ${parksRaw.length}`);
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

  const projectedRoads = projectRoads(roadsRaw, projection, widthPx, heightPx, limits);
  const projectedWater = projectPolygons(waterRaw, projection, widthPx, heightPx, limits);
  const projectedParks = projectPolygons(parksRaw, projection, widthPx, heightPx, limits);

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
    outputs.push(toPosterOutput(relativePath));

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
