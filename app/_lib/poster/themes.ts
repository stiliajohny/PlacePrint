import { promises as fs } from "node:fs";
import path from "node:path";

import { THEMES_DIR } from "@/app/_lib/poster/constants";
import type { PosterTheme, ThemeSummary } from "@/app/_lib/poster/types";

type RawTheme = {
  name?: string;
  description?: string;
  [key: string]: unknown;
};

const TERRACOTTA_FALLBACK: PosterTheme = {
  name: "Terracotta",
  description: "Mediterranean warmth - burnt orange and clay tones on cream",
  bg: "#F5EDE4",
  text: "#8B4513",
  gradient_color: "#F5EDE4",
  water: "#A8C4C4",
  parks: "#E8E0D0",
  road_motorway: "#A0522D",
  road_primary: "#B8653A",
  road_secondary: "#C9846A",
  road_tertiary: "#D9A08A",
  road_residential: "#E5C4B0",
  road_default: "#D9A08A"
};

function sanitizeTheme(raw: RawTheme, fallbackName: string): PosterTheme {
  const output: PosterTheme = {
    ...TERRACOTTA_FALLBACK,
    name: typeof raw.name === "string" ? raw.name : fallbackName,
    description: typeof raw.description === "string" ? raw.description : ""
  };

  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== "string") {
      continue;
    }

    if (key in output) {
      (output as Record<string, string>)[key] = value;
    }
  }

  return output;
}

export async function readAvailableThemes(): Promise<ThemeSummary[]> {
  const files = await fs.readdir(THEMES_DIR, { withFileTypes: true });
  const themeFiles = files
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const themes: ThemeSummary[] = [];

  for (const fileName of themeFiles) {
    const id = fileName.replace(/\.json$/i, "");
    const filePath = path.join(THEMES_DIR, fileName);

    try {
      const content = await fs.readFile(filePath, "utf8");
      const raw = JSON.parse(content) as RawTheme;
      const colors: Record<string, string> = {};

      for (const [key, value] of Object.entries(raw)) {
        if (typeof value === "string" && key !== "name" && key !== "description") {
          colors[key] = value;
        }
      }

      themes.push({
        id,
        name: typeof raw.name === "string" ? raw.name : id,
        description: typeof raw.description === "string" ? raw.description : "",
        colors
      });
    } catch {
      themes.push({
        id,
        name: id,
        description: "",
        colors: {}
      });
    }
  }

  return themes;
}

export async function loadTheme(themeName: string): Promise<PosterTheme> {
  const filePath = path.join(THEMES_DIR, `${themeName}.json`);

  try {
    const content = await fs.readFile(filePath, "utf8");
    return sanitizeTheme(JSON.parse(content) as RawTheme, themeName);
  } catch {
    return TERRACOTTA_FALLBACK;
  }
}
