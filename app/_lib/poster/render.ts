import type { ReactElement } from "react";

import { DEFAULT_DPI } from "@/app/_lib/poster/constants";
import type {
  FontBundle
} from "@/app/_lib/poster/fonts";
import { embeddedFontCss, satoriFonts } from "@/app/_lib/poster/fonts";
import type {
  MarkerIcon,
  MarkerSize,
  PosterScene,
  ProjectedPoint,
  ProjectedPolygonRings,
  ProjectedRoadFeature
} from "@/app/_lib/poster/types";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseHexColor(hexColor: string): [number, number, number] {
  const normalized = hexColor.trim().replace(/^#/, "");
  if (normalized.length === 3) {
    const r = Number.parseInt(normalized[0] + normalized[0], 16);
    const g = Number.parseInt(normalized[1] + normalized[1], 16);
    const b = Number.parseInt(normalized[2] + normalized[2], 16);
    return [r, g, b];
  }

  if (normalized.length !== 6) {
    return [0, 0, 0];
  }

  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16)
  ];
}

function rgbToHex(color: [number, number, number]): string {
  return `#${color
    .map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function mixColors(a: string, b: string, t: number): string {
  const colorA = parseHexColor(a);
  const colorB = parseHexColor(b);
  const mixed: [number, number, number] = [
    colorA[0] * (1 - t) + colorB[0] * t,
    colorA[1] * (1 - t) + colorB[1] * t,
    colorA[2] * (1 - t) + colorB[2] * t
  ];
  return rgbToHex(mixed);
}

function colorToPdfRgb(hexColor: string): string {
  const [r, g, b] = parseHexColor(hexColor);
  return `${(r / 255).toFixed(4)} ${(g / 255).toFixed(4)} ${(b / 255).toFixed(4)}`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapePdfText(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function pointToSvg(point: ProjectedPoint): string {
  return `${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
}

function ringToSvgPath(ring: ProjectedPoint[]): string {
  if (ring.length < 3) {
    return "";
  }

  const commands = [`M ${pointToSvg(ring[0])}`];
  for (let i = 1; i < ring.length; i += 1) {
    commands.push(`L ${pointToSvg(ring[i])}`);
  }
  commands.push("Z");
  return commands.join(" ");
}

function polygonToSvgPath(polygon: ProjectedPolygonRings): string {
  return polygon.rings
    .map((ring) => ringToSvgPath(ring))
    .filter((path) => path.length > 0)
    .join(" ");
}

function roadToSvgPath(road: ProjectedRoadFeature): string {
  if (road.points.length < 2) {
    return "";
  }

  const commands = [`M ${pointToSvg(road.points[0])}`];
  for (let i = 1; i < road.points.length; i += 1) {
    commands.push(`L ${pointToSvg(road.points[i])}`);
  }
  return commands.join(" ");
}

function roadColor(highway: string, scene: PosterScene): string {
  if (highway === "motorway" || highway === "motorway_link") {
    return scene.theme.road_motorway;
  }

  if (["trunk", "trunk_link", "primary", "primary_link"].includes(highway)) {
    return scene.theme.road_primary;
  }

  if (["secondary", "secondary_link"].includes(highway)) {
    return scene.theme.road_secondary;
  }

  if (["tertiary", "tertiary_link"].includes(highway)) {
    return scene.theme.road_tertiary;
  }

  if (["residential", "living_street", "unclassified"].includes(highway)) {
    return scene.theme.road_residential;
  }

  return scene.theme.road_default;
}

function roadWidthPx(highway: string, scaleFactor: number): number {
  let base = 0.4;

  if (highway === "motorway" || highway === "motorway_link") {
    base = 1.2;
  } else if (["trunk", "trunk_link", "primary", "primary_link"].includes(highway)) {
    base = 1.0;
  } else if (["secondary", "secondary_link"].includes(highway)) {
    base = 0.8;
  } else if (["tertiary", "tertiary_link"].includes(highway)) {
    base = 0.6;
  }

  return base * (DEFAULT_DPI / 72) * scaleFactor;
}

type MarkerGeometry = {
  tipX: number;
  tipY: number;
  circleX: number;
  circleY: number;
  outerRadius: number;
  innerRadius: number;
  tailHalfWidth: number;
};

function markerSizeMultiplier(markerSize: MarkerSize): number {
  if (markerSize === "small") {
    return 0.82;
  }

  if (markerSize === "large") {
    return 1.22;
  }

  return 1;
}

function resolveMarkerGeometry(scene: PosterScene): MarkerGeometry | null {
  if (!scene.marker) {
    return null;
  }

  const outerRadius = Math.max(8, 15 * scene.scaleFactor * markerSizeMultiplier(scene.markerSize));
  const innerRadius = Math.max(4.2, outerRadius * 0.58);
  const tailHalfWidth = outerRadius * 0.74;
  const circleY = scene.marker.y - outerRadius * 1.48;

  return {
    tipX: scene.marker.x,
    tipY: scene.marker.y,
    circleX: scene.marker.x,
    circleY,
    outerRadius,
    innerRadius,
    tailHalfWidth
  };
}

function relativeLuminance(hexColor: string): number {
  const [r, g, b] = parseHexColor(hexColor).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function iconColor(markerColor: string): string {
  return relativeLuminance(markerColor) > 0.42 ? "#101214" : "#ffffff";
}

function starPoints(cx: number, cy: number, outerRadius: number, innerRadius: number): ProjectedPoint[] {
  const points: ProjectedPoint[] = [];
  for (let i = 0; i < 10; i += 1) {
    const angle = -Math.PI / 2 + (Math.PI * i) / 5;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    points.push({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius
    });
  }

  return points;
}

function pointsToSvgPath(points: ProjectedPoint[]): string {
  if (points.length < 3) {
    return "";
  }

  const commands = [`M ${pointToSvg(points[0])}`];
  for (let i = 1; i < points.length; i += 1) {
    commands.push(`L ${pointToSvg(points[i])}`);
  }
  commands.push("Z");
  return commands.join(" ");
}

function pointsToPdfPath(points: ProjectedPoint[], canvasHeight: number): string {
  if (points.length < 3) {
    return "";
  }

  const commands = [`${points[0].x.toFixed(2)} ${(canvasHeight - points[0].y).toFixed(2)} m`];
  for (let i = 1; i < points.length; i += 1) {
    commands.push(`${points[i].x.toFixed(2)} ${(canvasHeight - points[i].y).toFixed(2)} l`);
  }
  commands.push("h");
  return commands.join(" ");
}

function markerIconSvg(icon: MarkerIcon, marker: MarkerGeometry, color: string): string {
  if (icon === "none") {
    return "";
  }

  if (icon === "dot") {
    return `<circle cx="${marker.circleX.toFixed(2)}" cy="${marker.circleY.toFixed(2)}" r="${(marker.innerRadius * 0.36).toFixed(2)}" fill="${color}" />`;
  }

  if (icon === "plus") {
    const span = marker.innerRadius * 0.88;
    const strokeWidth = Math.max(1.6, marker.innerRadius * 0.35);
    return `
    <line x1="${(marker.circleX - span).toFixed(2)}" y1="${marker.circleY.toFixed(2)}" x2="${(marker.circleX + span).toFixed(2)}" y2="${marker.circleY.toFixed(2)}" stroke="${color}" stroke-width="${strokeWidth.toFixed(2)}" stroke-linecap="round" />
    <line x1="${marker.circleX.toFixed(2)}" y1="${(marker.circleY - span).toFixed(2)}" x2="${marker.circleX.toFixed(2)}" y2="${(marker.circleY + span).toFixed(2)}" stroke="${color}" stroke-width="${strokeWidth.toFixed(2)}" stroke-linecap="round" />`;
  }

  if (icon === "star") {
    const path = pointsToSvgPath(
      starPoints(marker.circleX, marker.circleY, marker.innerRadius * 0.78, marker.innerRadius * 0.36)
    );
    return path ? `<path d="${path}" fill="${color}" />` : "";
  }

  return "";
}

function markerIconPdfCommands(icon: MarkerIcon, marker: MarkerGeometry, color: string, canvasHeight: number): string[] {
  if (icon === "none") {
    return [];
  }

  if (icon === "dot") {
    return [circlePdfPath(marker.circleX, marker.circleY, marker.innerRadius * 0.36, canvasHeight), "f"];
  }

  if (icon === "plus") {
    const span = marker.innerRadius * 0.88;
    const strokeWidth = Math.max(1.6, marker.innerRadius * 0.35);
    return [
      `${colorToPdfRgb(color)} RG`,
      `${strokeWidth.toFixed(2)} w`,
      "1 J",
      `${(marker.circleX - span).toFixed(2)} ${(canvasHeight - marker.circleY).toFixed(2)} m ${(marker.circleX + span).toFixed(2)} ${(canvasHeight - marker.circleY).toFixed(2)} l S`,
      `${marker.circleX.toFixed(2)} ${(canvasHeight - (marker.circleY - span)).toFixed(2)} m ${marker.circleX.toFixed(2)} ${(canvasHeight - (marker.circleY + span)).toFixed(2)} l S`
    ];
  }

  if (icon === "star") {
    const path = pointsToPdfPath(
      starPoints(marker.circleX, marker.circleY, marker.innerRadius * 0.78, marker.innerRadius * 0.36),
      canvasHeight
    );
    return path ? [path, "f"] : [];
  }

  return [];
}

function markerSvg(scene: PosterScene): string {
  const marker = resolveMarkerGeometry(scene);
  if (!marker) {
    return "";
  }

  const shoulderY = marker.circleY + marker.outerRadius * 0.94;
  const centerColor = mixColors(scene.markerColor, scene.theme.bg, 0.26);
  const iconLayer = markerIconSvg(scene.markerIcon, marker, iconColor(scene.markerColor));

  return `
  <g aria-label="City center marker">
    <path d="M ${(marker.tipX - marker.tailHalfWidth).toFixed(2)} ${shoulderY.toFixed(2)} L ${marker.tipX.toFixed(2)} ${marker.tipY.toFixed(2)} L ${(marker.tipX + marker.tailHalfWidth).toFixed(2)} ${shoulderY.toFixed(2)} Z" fill="${scene.markerColor}" />
    <circle cx="${marker.circleX.toFixed(2)}" cy="${marker.circleY.toFixed(2)}" r="${marker.outerRadius.toFixed(2)}" fill="${scene.markerColor}" />
    <circle cx="${marker.circleX.toFixed(2)}" cy="${marker.circleY.toFixed(2)}" r="${marker.innerRadius.toFixed(2)}" fill="${centerColor}" />
    ${iconLayer}
  </g>`;
}

function circlePdfPath(cx: number, cy: number, radius: number, canvasHeight: number): string {
  const k = radius * 0.552284749831;
  const pdfY = (value: number): string => (canvasHeight - value).toFixed(2);

  return [
    `${(cx + radius).toFixed(2)} ${pdfY(cy)} m`,
    `${(cx + radius).toFixed(2)} ${pdfY(cy + k)} ${(cx + k).toFixed(2)} ${pdfY(cy + radius)} ${cx.toFixed(2)} ${pdfY(cy + radius)} c`,
    `${(cx - k).toFixed(2)} ${pdfY(cy + radius)} ${(cx - radius).toFixed(2)} ${pdfY(cy + k)} ${(cx - radius).toFixed(2)} ${pdfY(cy)} c`,
    `${(cx - radius).toFixed(2)} ${pdfY(cy - k)} ${(cx - k).toFixed(2)} ${pdfY(cy - radius)} ${cx.toFixed(2)} ${pdfY(cy - radius)} c`,
    `${(cx + k).toFixed(2)} ${pdfY(cy - radius)} ${(cx + radius).toFixed(2)} ${pdfY(cy - k)} ${(cx + radius).toFixed(2)} ${pdfY(cy)} c`,
    "h"
  ].join(" ");
}

function approximateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.62;
}

export function sceneToSvg(scene: PosterScene, fonts: FontBundle | undefined): string {
  return sceneToSvgWithOptions(scene, fonts, { includeLabels: true });
}

type SvgRenderOptions = {
  includeLabels?: boolean;
};

export function sceneToSvgWithOptions(
  scene: PosterScene,
  fonts: FontBundle | undefined,
  options: SvgRenderOptions = {}
): string {
  const includeLabels = options.includeLabels ?? true;
  const width = scene.widthPx;
  const height = scene.heightPx;

  const waterPaths = scene.water
    .map((polygon) => polygonToSvgPath(polygon))
    .filter((path) => path.length > 0)
    .map(
      (path) =>
        `<path d="${path}" fill="${scene.theme.water}" fill-rule="evenodd" stroke="none" />`
    )
    .join("\n");

  const parkPaths = scene.parks
    .map((polygon) => polygonToSvgPath(polygon))
    .filter((path) => path.length > 0)
    .map(
      (path) =>
        `<path d="${path}" fill="${scene.theme.parks}" fill-rule="evenodd" stroke="none" />`
    )
    .join("\n");

  const roadPaths = scene.roads
    .map((road) => {
      const path = roadToSvgPath(road);
      if (!path) {
        return "";
      }

      const color = roadColor(road.highway, scene);
      const widthPx = roadWidthPx(road.highway, scene.scaleFactor);
      return `<path d="${path}" fill="none" stroke="${color}" stroke-width="${widthPx.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" />`;
    })
    .filter(Boolean)
    .join("\n");
  const markerLayer = markerSvg(scene);

  const fontCss = embeddedFontCss(fonts);

  const bottomY = (1 - 0.14) * height;
  const countryY = (1 - 0.10) * height;
  const coordsY = (1 - 0.07) * height;
  const lineY = (1 - 0.125) * height;
  const attributionY = (1 - 0.02) * height;
  const decorativeLineWidth = 1 * scene.scaleFactor * (DEFAULT_DPI / 72);

  const labelsBlock = includeLabels
    ? `
  <text x="${width * 0.5}" y="${bottomY}" fill="${scene.theme.text}" font-family="${escapeXml(scene.fontFamilyMain)}" font-size="${scene.fontSizeMain.toFixed(2)}" text-anchor="middle">${escapeXml(scene.mainTitle)}</text>
  <line x1="${width * 0.4}" y1="${lineY}" x2="${width * 0.6}" y2="${lineY}" stroke="${scene.theme.text}" stroke-width="${decorativeLineWidth.toFixed(2)}" />
  <text x="${width * 0.5}" y="${countryY}" fill="${scene.theme.text}" font-family="${escapeXml(scene.fontFamilySub)}" font-size="${scene.fontSizeSub.toFixed(2)}" text-anchor="middle">${escapeXml(scene.countryTitle)}</text>
  <text x="${width * 0.5}" y="${coordsY}" fill="${scene.theme.text}" fill-opacity="0.7" font-family="${escapeXml(scene.fontFamilyCoords)}" font-size="${scene.fontSizeCoords.toFixed(2)}" text-anchor="middle">${escapeXml(scene.coordinatesLabel)}</text>
  <text x="${width * 0.98}" y="${attributionY}" fill="${scene.theme.text}" fill-opacity="0.5" font-family="${escapeXml(scene.fontFamilyAttr)}" font-size="${scene.fontSizeAttr.toFixed(2)}" text-anchor="end">&#169; OpenStreetMap contributors</text>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="City map poster">
  <defs>
    <linearGradient id="bottomGradient" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="${scene.theme.gradient_color}" stop-opacity="1" />
      <stop offset="100%" stop-color="${scene.theme.gradient_color}" stop-opacity="0" />
    </linearGradient>
    <linearGradient id="topGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${scene.theme.gradient_color}" stop-opacity="1" />
      <stop offset="100%" stop-color="${scene.theme.gradient_color}" stop-opacity="0" />
    </linearGradient>
  </defs>
  ${fontCss}
  <rect x="0" y="0" width="${width}" height="${height}" fill="${scene.theme.bg}" />
  ${waterPaths}
  ${parkPaths}
  ${roadPaths}
  ${markerLayer}
  <rect x="0" y="${height * 0.75}" width="${width}" height="${height * 0.25}" fill="url(#bottomGradient)" />
  <rect x="0" y="0" width="${width}" height="${height * 0.25}" fill="url(#topGradient)" />
  ${labelsBlock}
</svg>`;
}

export async function sceneSvgToPng(svg: string, scene: PosterScene, fonts: FontBundle | undefined): Promise<Buffer> {
  const React = await import("react");
  const { ImageResponse } = await import("next/og");

  const svgDataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  const decorativeLineWidth = 1 * scene.scaleFactor * (DEFAULT_DPI / 72);
  const mainBaselineY = (1 - 0.14) * scene.heightPx;
  const countryBaselineY = (1 - 0.10) * scene.heightPx;
  const coordsBaselineY = (1 - 0.07) * scene.heightPx;
  const lineY = (1 - 0.125) * scene.heightPx;

  const baselineTop = (baselineY: number, fontSizePx: number): number =>
    Math.max(0, baselineY - fontSizePx * 0.8);

  const imageElement: ReactElement = React.createElement(
    "div",
    {
      style: {
        position: "relative",
        width: `${scene.widthPx}px`,
        height: `${scene.heightPx}px`,
        display: "flex",
        overflow: "hidden"
      }
    },
    React.createElement("img", {
      src: svgDataUrl,
      width: scene.widthPx,
      height: scene.heightPx,
      style: {
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%"
      }
    }),
    React.createElement(
      "div",
      {
        style: {
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: "100%",
          display: "flex"
        }
      },
      React.createElement("div", {
        style: {
          position: "absolute",
          left: "40%",
          top: `${(lineY - decorativeLineWidth / 2).toFixed(2)}px`,
          width: "20%",
          borderTop: `${decorativeLineWidth.toFixed(2)}px solid ${scene.theme.text}`
        }
      }),
      React.createElement(
        "div",
        {
          style: {
            position: "absolute",
            left: 0,
            width: "100%",
            top: `${baselineTop(mainBaselineY, scene.fontSizeMain).toFixed(2)}px`,
            display: "flex",
            justifyContent: "center",
            paddingLeft: "6%",
            paddingRight: "6%",
            boxSizing: "border-box",
            color: scene.theme.text,
            fontFamily: scene.fontFamilyMain,
            fontSize: `${scene.fontSizeMain.toFixed(2)}px`,
            whiteSpace: "pre",
            lineHeight: "1",
            textAlign: "center",
            overflow: "visible"
          }
        },
        scene.mainTitle
      ),
      React.createElement(
        "div",
        {
          style: {
            position: "absolute",
            left: 0,
            width: "100%",
            top: `${baselineTop(countryBaselineY, scene.fontSizeSub).toFixed(2)}px`,
            display: "flex",
            justifyContent: "center",
            paddingLeft: "4%",
            paddingRight: "4%",
            boxSizing: "border-box",
            color: scene.theme.text,
            fontFamily: scene.fontFamilySub,
            fontSize: `${scene.fontSizeSub.toFixed(2)}px`,
            whiteSpace: "pre",
            lineHeight: "1",
            textAlign: "center",
            overflow: "visible"
          }
        },
        scene.countryTitle
      ),
      React.createElement(
        "div",
        {
          style: {
            position: "absolute",
            left: 0,
            width: "100%",
            top: `${baselineTop(coordsBaselineY, scene.fontSizeCoords).toFixed(2)}px`,
            display: "flex",
            justifyContent: "center",
            paddingLeft: "4%",
            paddingRight: "4%",
            boxSizing: "border-box",
            color: scene.theme.text,
            opacity: 0.7,
            fontFamily: scene.fontFamilyCoords,
            fontSize: `${scene.fontSizeCoords.toFixed(2)}px`,
            whiteSpace: "pre",
            lineHeight: "1",
            textAlign: "center",
            overflow: "visible"
          }
        },
        scene.coordinatesLabel
      ),
      React.createElement(
        "div",
        {
          style: {
            position: "absolute",
            right: "2%",
            bottom: "2%",
            color: scene.theme.text,
            opacity: 0.5,
            fontFamily: scene.fontFamilyAttr,
            fontSize: `${scene.fontSizeAttr.toFixed(2)}px`,
            textAlign: "right"
          }
        },
        "\u00a9 OpenStreetMap contributors"
      )
    )
  );

  const response = new ImageResponse(imageElement, {
    width: scene.widthPx,
    height: scene.heightPx,
    fonts: satoriFonts(fonts)
  });

  return Buffer.from(await response.arrayBuffer());
}

export function sceneToPdf(scene: PosterScene): Buffer {
  const w = scene.widthPx;
  const h = scene.heightPx;

  const lines: string[] = [];

  lines.push(`${colorToPdfRgb(scene.theme.bg)} rg`);
  lines.push(`0 0 ${w.toFixed(2)} ${h.toFixed(2)} re f`);

  for (const polygon of scene.water) {
    const pathSegments: string[] = [];
    for (const ring of polygon.rings) {
      if (ring.length < 3) {
        continue;
      }

      const first = ring[0];
      pathSegments.push(`${first.x.toFixed(2)} ${(h - first.y).toFixed(2)} m`);
      for (let i = 1; i < ring.length; i += 1) {
        const point = ring[i];
        pathSegments.push(`${point.x.toFixed(2)} ${(h - point.y).toFixed(2)} l`);
      }
      pathSegments.push("h");
    }

    if (pathSegments.length > 0) {
      lines.push(`${colorToPdfRgb(scene.theme.water)} rg`);
      lines.push(pathSegments.join(" "));
      lines.push("f*");
    }
  }

  for (const polygon of scene.parks) {
    const pathSegments: string[] = [];
    for (const ring of polygon.rings) {
      if (ring.length < 3) {
        continue;
      }

      const first = ring[0];
      pathSegments.push(`${first.x.toFixed(2)} ${(h - first.y).toFixed(2)} m`);
      for (let i = 1; i < ring.length; i += 1) {
        const point = ring[i];
        pathSegments.push(`${point.x.toFixed(2)} ${(h - point.y).toFixed(2)} l`);
      }
      pathSegments.push("h");
    }

    if (pathSegments.length > 0) {
      lines.push(`${colorToPdfRgb(scene.theme.parks)} rg`);
      lines.push(pathSegments.join(" "));
      lines.push("f*");
    }
  }

  for (const road of scene.roads) {
    if (road.points.length < 2) {
      continue;
    }

    lines.push(`${colorToPdfRgb(roadColor(road.highway, scene))} RG`);
    lines.push(`${roadWidthPx(road.highway, scene.scaleFactor).toFixed(2)} w`);
    lines.push("1 J 1 j");

    const first = road.points[0];
    lines.push(`${first.x.toFixed(2)} ${(h - first.y).toFixed(2)} m`);
    for (let i = 1; i < road.points.length; i += 1) {
      const point = road.points[i];
      lines.push(`${point.x.toFixed(2)} ${(h - point.y).toFixed(2)} l`);
    }
    lines.push("S");
  }

  const marker = resolveMarkerGeometry(scene);
  if (marker) {
    const shoulderY = marker.circleY + marker.outerRadius * 0.94;
    const centerColor = mixColors(scene.markerColor, scene.theme.bg, 0.26);
    const iconFill = iconColor(scene.markerColor);

    lines.push(`${colorToPdfRgb(scene.markerColor)} rg`);
    lines.push(
      `${(marker.tipX - marker.tailHalfWidth).toFixed(2)} ${(h - shoulderY).toFixed(2)} m ${marker.tipX.toFixed(2)} ${(h - marker.tipY).toFixed(2)} l ${(marker.tipX + marker.tailHalfWidth).toFixed(2)} ${(h - shoulderY).toFixed(2)} l h`
    );
    lines.push("f");

    lines.push(`${colorToPdfRgb(scene.markerColor)} rg`);
    lines.push(circlePdfPath(marker.circleX, marker.circleY, marker.outerRadius, h));
    lines.push("f");

    lines.push(`${colorToPdfRgb(centerColor)} rg`);
    lines.push(circlePdfPath(marker.circleX, marker.circleY, marker.innerRadius, h));
    lines.push("f");

    if (scene.markerIcon !== "none") {
      lines.push(`${colorToPdfRgb(iconFill)} rg`);
      lines.push(...markerIconPdfCommands(scene.markerIcon, marker, iconFill, h));
    }
  }

  const bottomY = (1 - 0.14) * h;
  const countryY = (1 - 0.10) * h;
  const coordsY = (1 - 0.07) * h;
  const lineY = (1 - 0.125) * h;
  const attrY = (1 - 0.02) * h;
  const decorativeLineWidth = 1 * scene.scaleFactor * (DEFAULT_DPI / 72);

  lines.push(`${colorToPdfRgb(scene.theme.text)} RG`);
  lines.push(`${decorativeLineWidth.toFixed(2)} w`);
  lines.push(`${(w * 0.4).toFixed(2)} ${(h - lineY).toFixed(2)} m ${(w * 0.6).toFixed(2)} ${(h - lineY).toFixed(2)} l S`);

  const textColor = colorToPdfRgb(scene.theme.text);

  const mainWidth = approximateTextWidth(scene.mainTitle, scene.fontSizeMain);
  const subWidth = approximateTextWidth(scene.countryTitle, scene.fontSizeSub);
  const coordsWidth = approximateTextWidth(scene.coordinatesLabel, scene.fontSizeCoords);
  const attrText = "\u00a9 OpenStreetMap contributors";
  const attrWidth = approximateTextWidth(attrText, scene.fontSizeAttr);

  lines.push("BT");
  lines.push(`/F2 ${scene.fontSizeMain.toFixed(2)} Tf`);
  lines.push(`${textColor} rg`);
  lines.push(`${(w * 0.5 - mainWidth / 2).toFixed(2)} ${(h - bottomY).toFixed(2)} Td`);
  lines.push(`(${escapePdfText(scene.mainTitle)}) Tj`);
  lines.push("ET");

  lines.push("BT");
  lines.push(`/F1 ${scene.fontSizeSub.toFixed(2)} Tf`);
  lines.push(`${textColor} rg`);
  lines.push(`${(w * 0.5 - subWidth / 2).toFixed(2)} ${(h - countryY).toFixed(2)} Td`);
  lines.push(`(${escapePdfText(scene.countryTitle)}) Tj`);
  lines.push("ET");

  lines.push("BT");
  lines.push(`/F1 ${scene.fontSizeCoords.toFixed(2)} Tf`);
  lines.push(`${colorToPdfRgb(mixColors(scene.theme.text, "#ffffff", 0.3))} rg`);
  lines.push(`${(w * 0.5 - coordsWidth / 2).toFixed(2)} ${(h - coordsY).toFixed(2)} Td`);
  lines.push(`(${escapePdfText(scene.coordinatesLabel)}) Tj`);
  lines.push("ET");

  lines.push("BT");
  lines.push(`/F1 ${scene.fontSizeAttr.toFixed(2)} Tf`);
  lines.push(`${colorToPdfRgb(mixColors(scene.theme.text, "#ffffff", 0.5))} rg`);
  lines.push(`${(w * 0.98 - attrWidth).toFixed(2)} ${(h - attrY).toFixed(2)} Td`);
  lines.push(`(${escapePdfText(attrText)}) Tj`);
  lines.push("ET");

  const content = Buffer.from(lines.join("\n"), "utf8");

  const objects: Buffer[] = [];

  const pushObject = (value: string | Buffer): number => {
    const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
    objects.push(buffer);
    return objects.length;
  };

  const catalogId = pushObject("<< /Type /Catalog /Pages 2 0 R >>");
  if (catalogId !== 1) {
    throw new Error("Unexpected PDF object ordering");
  }

  pushObject("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  pushObject(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w.toFixed(2)} ${h.toFixed(2)}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`
  );
  pushObject(Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`, "utf8"), content, Buffer.from("\nendstream", "utf8")]));
  pushObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  pushObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "binary")];
  const offsets: number[] = [0];
  let cursor = chunks[0].length;

  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(cursor);
    const objectHeader = Buffer.from(`${i + 1} 0 obj\n`, "utf8");
    const objectBody = objects[i];
    const objectFooter = Buffer.from("\nendobj\n", "utf8");

    chunks.push(objectHeader, objectBody, objectFooter);
    cursor += objectHeader.length + objectBody.length + objectFooter.length;
  }

  const xrefOffset = cursor;
  const xrefLines = ["xref", `0 ${objects.length + 1}`, "0000000000 65535 f "];
  for (let i = 1; i < offsets.length; i += 1) {
    xrefLines.push(`${offsets[i].toString().padStart(10, "0")} 00000 n `);
  }

  const trailer = [
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefOffset),
    "%%EOF"
  ].join("\n");

  chunks.push(Buffer.from(`${xrefLines.join("\n")}\n${trailer}`, "utf8"));

  return Buffer.concat(chunks);
}
