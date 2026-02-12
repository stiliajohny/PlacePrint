import { promises as fs } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

import { POSTERS_DIR } from "@/app/_lib/poster/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  svg: "image/svg+xml",
  pdf: "application/pdf"
};

function sanitizePosterPath(input: string): string | null {
  const normalized = path.posix.normalize(input.replaceAll("\\", "/"));
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

  return relativeToRoot;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const relative = searchParams.get("path");

  if (!relative) {
    return NextResponse.json({ error: "missing path" }, { status: 400 });
  }

  const relativeToRoot = sanitizePosterPath(relative);
  if (!relativeToRoot) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }

  const absolutePath = path.join(POSTERS_DIR, relativeToRoot);

  try {
    const buffer = await fs.readFile(absolutePath);
    const ext = path.extname(absolutePath).replace(".", "").toLowerCase();
    const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store"
      }
    });
  } catch {
    return NextResponse.json({ error: "file not found" }, { status: 404 });
  }
}
