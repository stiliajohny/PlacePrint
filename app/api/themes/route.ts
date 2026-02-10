import { NextResponse } from "next/server";

import { readAvailableThemes } from "@/app/_lib/poster/themes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const themes = await readAvailableThemes();
    return NextResponse.json({ themes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to load themes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
