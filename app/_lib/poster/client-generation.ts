export type GenerateResponse = {
  ok?: boolean;
  outputs?: Array<{
    relativePath: string;
    fileName: string;
    format: string;
    downloadUrl: string;
    previewUrl: string | null;
  }>;
  logs?: string;
  stderr?: string;
  error?: string;
  details?: string[];
  availableThemes?: string[];
};

export type GenerationFailure = {
  message: string;
  details: string[];
  technical: string | null;
};

export async function readGenerateResponse(response: Response): Promise<{
  data: GenerateResponse | null;
  rawText: string;
}> {
  const rawText = await response.text();
  if (!rawText) {
    return { data: null, rawText: "" };
  }

  try {
    return {
      data: JSON.parse(rawText) as GenerateResponse,
      rawText
    };
  } catch {
    return {
      data: null,
      rawText
    };
  }
}

export function buildGenerationFailure(
  status: number,
  data: GenerateResponse | null,
  rawText: string
): GenerationFailure {
  const details: string[] = [];

  if (data?.details && data.details.length > 0) {
    details.push(...data.details);
  }

  if (data?.availableThemes && data.availableThemes.length > 0) {
    details.push(`Available themes: ${data.availableThemes.join(", ")}`);
  }

  details.push(`HTTP status: ${status}`);

  const message =
    typeof data?.error === "string" && data.error.trim().length > 0
      ? data.error.trim()
      : `Poster generation failed (HTTP ${status}).`;

  const technical = [data?.stderr, data?.logs]
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    .join("\n\n")
    .trim();

  if (technical) {
    return {
      message,
      details,
      technical
    };
  }

  const raw = rawText.trim();
  if (raw && !data) {
    return {
      message,
      details,
      technical: raw.slice(0, 8000)
    };
  }

  return {
    message,
    details,
    technical: null
  };
}
