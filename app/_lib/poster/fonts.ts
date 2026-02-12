import { promises as fs } from "node:fs";
import path from "node:path";

import { FONTS_DIR, FONT_CACHE_DIR } from "@/app/_lib/poster/constants";
import { fetchWithTimeout } from "@/app/_lib/poster/http";

export type FontAsset = {
  family: string;
  weight: 300 | 400 | 700;
  data: Buffer;
  format: "ttf" | "otf" | "woff" | "woff2";
};

export type FontBundle = {
  light: FontAsset;
  regular: FontAsset;
  bold: FontAsset;
};

const ROBOTO_FONT_PATHS: Record<"light" | "regular" | "bold", string> = {
  light: path.join(FONTS_DIR, "Roboto-Light.ttf"),
  regular: path.join(FONTS_DIR, "Roboto-Regular.ttf"),
  bold: path.join(FONTS_DIR, "Roboto-Bold.ttf")
};

function extensionToFormat(filePath: string): FontAsset["format"] {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case ".otf":
      return "otf";
    case ".woff":
      return "woff";
    case ".woff2":
      return "woff2";
    case ".ttf":
    default:
      return "ttf";
  }
}

function fontMime(format: FontAsset["format"]): string {
  switch (format) {
    case "otf":
      return "font/otf";
    case "woff":
      return "font/woff";
    case "woff2":
      return "font/woff2";
    case "ttf":
    default:
      return "font/ttf";
  }
}

async function readLocalRoboto(): Promise<FontBundle | undefined> {
  try {
    const [lightData, regularData, boldData] = await Promise.all([
      fs.readFile(ROBOTO_FONT_PATHS.light),
      fs.readFile(ROBOTO_FONT_PATHS.regular),
      fs.readFile(ROBOTO_FONT_PATHS.bold)
    ]);

    return {
      light: {
        family: "PosterFontLight",
        weight: 300,
        data: lightData,
        format: "ttf"
      },
      regular: {
        family: "PosterFontRegular",
        weight: 400,
        data: regularData,
        format: "ttf"
      },
      bold: {
        family: "PosterFontBold",
        weight: 700,
        data: boldData,
        format: "ttf"
      }
    };
  } catch {
    return undefined;
  }
}

async function downloadGoogleFont(fontFamily: string): Promise<FontBundle | undefined> {
  const safeFamily = fontFamily.trim().replace(/\s+/g, " ");
  if (!safeFamily) {
    return undefined;
  }

  const slug = safeFamily.toLowerCase().replace(/\s+/g, "_");
  const requestedWeights: Array<300 | 400 | 700> = [300, 400, 700];

  const cssUrl = new URL("https://fonts.googleapis.com/css2");
  cssUrl.searchParams.set("family", `${safeFamily}:wght@300;400;700`);

  const cssResponse = await fetchWithTimeout(cssUrl.toString(), {
    headers: {
      "User-Agent":
        process.env.GOOGLE_FONTS_USER_AGENT?.trim() ||
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
    }
  });

  if (!cssResponse.ok) {
    return undefined;
  }

  const cssText = await cssResponse.text();
  const blocks = cssText.split("@font-face");

  const urlByWeight = new Map<number, string>();
  for (const block of blocks) {
    const weightMatch = block.match(/font-weight:\s*(\d+)/i);
    const srcMatch = block.match(/url\((https:[^)]+\.(?:woff2|woff|ttf|otf))\)/i);

    if (!weightMatch || !srcMatch) {
      continue;
    }

    urlByWeight.set(Number(weightMatch[1]), srcMatch[1]);
  }

  const downloaded = new Map<number, FontAsset>();

  try {
    await fs.mkdir(FONT_CACHE_DIR, { recursive: true });
  } catch {
    // Ignore write failures (serverless read-only FS), we'll keep fonts in memory.
  }

  for (const weight of requestedWeights) {
    let url = urlByWeight.get(weight);

    if (!url && urlByWeight.size > 0) {
      let closestWeight: number | undefined;
      for (const candidate of urlByWeight.keys()) {
        if (closestWeight === undefined) {
          closestWeight = candidate;
          continue;
        }

        if (Math.abs(candidate - weight) < Math.abs(closestWeight - weight)) {
          closestWeight = candidate;
        }
      }

      if (closestWeight !== undefined) {
        url = urlByWeight.get(closestWeight);
      }
    }

    if (!url) {
      continue;
    }

    const urlExtension = path.extname(new URL(url).pathname).replace(".", "") || "woff2";
    const format = extensionToFormat(`font.${urlExtension}`);
    const cacheFile = path.join(FONT_CACHE_DIR, `${slug}_${weight}.${format}`);

    let buffer: Buffer | undefined;

    try {
      buffer = await fs.readFile(cacheFile);
    } catch {
      // Cache miss.
    }

    if (!buffer) {
      const fontResponse = await fetchWithTimeout(url);
      if (!fontResponse.ok) {
        continue;
      }

      buffer = Buffer.from(await fontResponse.arrayBuffer());
      try {
        await fs.writeFile(cacheFile, buffer);
      } catch {
        // Ignore cache write failures.
      }
    }

    downloaded.set(weight, {
      family: `PosterFont${weight}`,
      weight,
      data: buffer,
      format
    });
  }

  if (!downloaded.has(400) && downloaded.size > 0) {
    const first = [...downloaded.values()][0];
    downloaded.set(400, { ...first, family: "PosterFont400", weight: 400 });
  }

  if (!downloaded.has(300) && downloaded.has(400)) {
    downloaded.set(300, { ...downloaded.get(400)!, family: "PosterFont300", weight: 300 });
  }

  if (!downloaded.has(700) && downloaded.has(400)) {
    downloaded.set(700, { ...downloaded.get(400)!, family: "PosterFont700", weight: 700 });
  }

  if (!downloaded.has(300) || !downloaded.has(400) || !downloaded.has(700)) {
    return undefined;
  }

  return {
    light: downloaded.get(300)!,
    regular: downloaded.get(400)!,
    bold: downloaded.get(700)!
  };
}

export async function loadFonts(fontFamily?: string): Promise<FontBundle | undefined> {
  const normalized = fontFamily?.trim();

  if (normalized && normalized.toLowerCase() !== "roboto") {
    const downloaded = await downloadGoogleFont(normalized);
    if (downloaded) {
      return downloaded;
    }
  }

  return readLocalRoboto();
}

export function embeddedFontCss(fontBundle: FontBundle | undefined): string {
  if (!fontBundle) {
    return "";
  }

  const faces = [fontBundle.light, fontBundle.regular, fontBundle.bold]
    .map((asset) => {
      const base64 = asset.data.toString("base64");
      return `@font-face{font-family:'${asset.family}';src:url(data:${fontMime(asset.format)};base64,${base64}) format('${asset.format}');font-weight:${asset.weight};font-style:normal;}`;
    })
    .join("\n");

  return `<style>${faces}</style>`;
}

export function satoriFonts(fontBundle: FontBundle | undefined): Array<{
  name: string;
  data: ArrayBuffer;
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  style: "normal";
}> {
  if (!fontBundle) {
    return [];
  }

  const bundleEntries = [fontBundle.light, fontBundle.regular, fontBundle.bold];
  return bundleEntries.map((asset) => ({
    name: asset.family,
    data: asset.data.buffer.slice(
      asset.data.byteOffset,
      asset.data.byteOffset + asset.data.byteLength
    ) as ArrayBuffer,
    weight: asset.weight,
    style: "normal"
  }));
}
