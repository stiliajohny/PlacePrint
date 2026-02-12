import { NextResponse } from "next/server";

import { validatePosterRequest } from "@/app/_lib/poster/request";
import { generatePosterViaJs } from "@/app/_lib/poster/js-generator";
import { logger } from "@/app/_lib/poster/logger";
import { readAvailableThemes } from "@/app/_lib/poster/themes";
import type { PosterRequestInput } from "@/app/_lib/poster/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: PosterRequestInput;

  try {
    body = (await request.json()) as PosterRequestInput;
  } catch {
    logger.warn("Invalid JSON body in /api/posters");
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const validated = validatePosterRequest(body);
  if (!validated.ok) {
    logger.warn("Validation failed for /api/posters", { details: validated.errors });
    return NextResponse.json(
      {
        error: "validation failed",
        details: validated.errors
      },
      { status: 400 }
    );
  }

  try {
    const themes = await readAvailableThemes();
    const themeIds = new Set(themes.map((theme) => theme.id));
    if (themeIds.size === 0) {
      return NextResponse.json({ error: "no themes found in themes directory" }, { status: 500 });
    }

    if (!validated.value.allThemes && !themeIds.has(validated.value.theme)) {
      return NextResponse.json(
        {
          error: `theme '${validated.value.theme}' not found`,
          availableThemes: [...themeIds]
        },
        { status: 400 }
      );
    }

    const run = await generatePosterViaJs(validated.value);

    logger.info("POST /api/posters completed", { outputs: run.outputs.length });
    return NextResponse.json({
      ok: true,
      outputs: run.outputs,
      logs: run.stdout,
      stderr: run.stderr
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "poster generation failed";
    logger.error("POST /api/posters failed", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
