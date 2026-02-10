import { promises as fs } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

import { GENERATED_TEMPLATES_DIR, GENERATED_TEMPLATES_SUBDIR, POSTERS_DIR } from "@/app/_lib/poster/constants";
import { ensurePosterDirs } from "@/app/_lib/poster/cache";
import { generatePosterViaJsWithOptions } from "@/app/_lib/poster/js-generator";
import { logger } from "@/app/_lib/poster/logger";
import { readAvailableThemes } from "@/app/_lib/poster/themes";
import {
  buildShowcasePosterRequest,
  THEME_SHOWCASE_SEEDS,
  type ShowcaseManifest
} from "@/app/_lib/poster/theme-showcase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MANIFEST_FILE = path.join(POSTERS_DIR, "showcase_manifest.json");
const GENERATED_TEMPLATES_RELATIVE_DIR = path.posix.join("posters", GENERATED_TEMPLATES_SUBDIR);

type ShowcaseItem = {
  themeId: string;
  themeName: string;
  themeDescription: string;
  colors: Record<string, string>;
  city: string;
  country: string;
  latitude: string;
  longitude: string;
  distance: number;
  note: string;
  relativePath: string | null;
  previewUrl: string | null;
};

type ShowcaseResponse = {
  items: ShowcaseItem[];
  generatedAt: string | null;
  errors: string[];
};

function toManifestFallback(): ShowcaseManifest {
  return {
    generatedAt: null,
    entries: {}
  };
}

function normalizePosterRelativePath(relativePath: string): string | null {
  const normalized = path.posix.normalize(relativePath.replaceAll("\\", "/"));
  if (!normalized.startsWith("posters/")) {
    return null;
  }

  if (normalized.includes("../")) {
    return null;
  }

  const relativeToRoot = normalized.slice("posters/".length);
  if (!relativeToRoot || relativeToRoot.startsWith("/")) {
    return null;
  }

  return normalized;
}

function toAbsolutePosterPath(relativePath: string | null | undefined): string | null {
  if (!relativePath) {
    return null;
  }

  const normalized = normalizePosterRelativePath(relativePath);
  if (!normalized) {
    return null;
  }

  return path.join(POSTERS_DIR, normalized.slice("posters/".length));
}

async function readManifest(): Promise<ShowcaseManifest> {
  try {
    const raw = await fs.readFile(MANIFEST_FILE, "utf8");
    const parsed = JSON.parse(raw) as ShowcaseManifest;

    if (!parsed || typeof parsed !== "object" || typeof parsed.entries !== "object" || !parsed.entries) {
      return toManifestFallback();
    }

    const sanitizedEntries: Record<string, string> = {};
    for (const [themeId, relativePath] of Object.entries(parsed.entries as Record<string, unknown>)) {
      if (typeof relativePath === "string") {
        const normalized = normalizePosterRelativePath(relativePath);
        if (normalized) {
          sanitizedEntries[themeId] = normalized;
        }
      }
    }

    return {
      generatedAt: typeof parsed.generatedAt === "string" ? parsed.generatedAt : null,
      entries: sanitizedEntries
    };
  } catch {
    return toManifestFallback();
  }
}

async function writeManifest(manifest: ShowcaseManifest): Promise<void> {
  await ensurePosterDirs([POSTERS_DIR]);
  await fs.writeFile(MANIFEST_FILE, JSON.stringify(manifest, null, 2), "utf8");
}

async function relativePosterPathExists(relativePath: string | null | undefined): Promise<boolean> {
  const absolutePath = toAbsolutePosterPath(relativePath);
  if (!absolutePath) {
    return false;
  }

  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

function previewUrl(relativePath: string | null): string | null {
  if (!relativePath) {
    return null;
  }

  return `/api/posters/file?path=${encodeURIComponent(relativePath)}`;
}

async function findLatestThemePosterPathInDir(
  themeId: string,
  absoluteDir: string,
  relativeDir: string
): Promise<string | null> {
  try {
    const files = await fs.readdir(absoluteDir, { withFileTypes: true });
    const matching = files
      .filter((entry) => entry.isFile() && entry.name.endsWith(".png") && entry.name.includes(`_${themeId}_`))
      .map((entry) => entry.name)
      .sort((a, b) => b.localeCompare(a));

    const newest = matching[0];
    return newest ? path.posix.join(relativeDir, newest) : null;
  } catch {
    return null;
  }
}

async function findLatestThemePosterPath(themeId: string): Promise<string | null> {
  const fromTemplates = await findLatestThemePosterPathInDir(
    themeId,
    GENERATED_TEMPLATES_DIR,
    GENERATED_TEMPLATES_RELATIVE_DIR
  );
  if (fromTemplates) {
    return fromTemplates;
  }

  return findLatestThemePosterPathInDir(themeId, POSTERS_DIR, "posters");
}

async function buildShowcaseResponse(errors: string[]): Promise<ShowcaseResponse> {
  const [themes, manifest] = await Promise.all([readAvailableThemes(), readManifest()]);
  const themeById = new Map(themes.map((theme) => [theme.id, theme]));
  const items: ShowcaseItem[] = [];

  for (const seed of THEME_SHOWCASE_SEEDS) {
    const theme = themeById.get(seed.themeId);
    if (!theme) {
      items.push({
        themeId: seed.themeId,
        themeName: seed.themeId,
        themeDescription: "",
        colors: {},
        city: seed.city,
        country: seed.country,
        latitude: seed.latitude,
        longitude: seed.longitude,
        distance: seed.distance,
        note: seed.note,
        relativePath: null,
        previewUrl: null
      });
      continue;
    }

    const storedPath = manifest.entries[seed.themeId] ?? (await findLatestThemePosterPath(seed.themeId));
    const hasFile = await relativePosterPathExists(storedPath);
    const relativePath = hasFile ? storedPath : null;

    items.push({
      themeId: seed.themeId,
      themeName: theme.name,
      themeDescription: theme.description,
      colors: theme.colors,
      city: seed.city,
      country: seed.country,
      latitude: seed.latitude,
      longitude: seed.longitude,
      distance: seed.distance,
      note: seed.note,
      relativePath,
      previewUrl: previewUrl(relativePath)
    });
  }

  return {
    items,
    generatedAt: manifest.generatedAt,
    errors
  };
}

export async function GET() {
  try {
    const response = await buildShowcaseResponse([]);
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to load showcase";
    logger.error("GET /api/showcase failed", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      {
        error: "showcase generation is only available in development"
      },
      { status: 403 }
    );
  }

  let regenerate = false;

  try {
    const body = (await request.json()) as { regenerate?: unknown };
    regenerate = body.regenerate === true;
  } catch {
    regenerate = false;
  }

  try {
    const [themes, manifest] = await Promise.all([readAvailableThemes(), readManifest()]);
    const themeIds = new Set(themes.map((theme) => theme.id));
    const errors: string[] = [];

    for (const seed of THEME_SHOWCASE_SEEDS) {
      if (!themeIds.has(seed.themeId)) {
        errors.push(`${seed.themeId}: theme not found`);
        continue;
      }

      const existingPath = manifest.entries[seed.themeId];
      if (!regenerate && (await relativePosterPathExists(existingPath))) {
        continue;
      }

      try {
        const run = await generatePosterViaJsWithOptions(buildShowcasePosterRequest(seed), {
          outputSubdir: GENERATED_TEMPLATES_SUBDIR
        });
        const output = run.outputs[0];

        if (!output) {
          errors.push(`${seed.themeId}: no output generated`);
          continue;
        }

        manifest.entries[seed.themeId] = output.relativePath;
      } catch (error) {
        const message = error instanceof Error ? error.message : "generation failed";
        errors.push(`${seed.themeId}: ${message}`);
      }
    }

    manifest.generatedAt = new Date().toISOString();
    await writeManifest(manifest);

    const response = await buildShowcaseResponse(errors);
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to generate showcase";
    logger.error("POST /api/showcase failed", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
