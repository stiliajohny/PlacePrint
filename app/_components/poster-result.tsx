"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  JOURNEY_RESULT_STORAGE_KEY,
  parseStoredJourneyResult,
  type JourneyResult
} from "@/app/_lib/poster/journey-storage";

export function PosterResult() {
  const [result, setResult] = useState<JourneyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const parsed = parseStoredJourneyResult(sessionStorage.getItem(JOURNEY_RESULT_STORAGE_KEY));
      setResult(parsed.data);
      setError(parsed.error);
    } catch {
      setResult(null);
      setError("Could not read generated result from this browser session.");
    }
  }, []);

  const summary = useMemo(() => {
    if (!result) {
      return "";
    }

    const locationLabel =
      result.payload.city && result.payload.country
        ? `${result.payload.city}, ${result.payload.country}`
        : result.payload.latitude && result.payload.longitude
          ? `Coordinates ${result.payload.latitude}, ${result.payload.longitude}`
          : "Location";

    const themeLabel = result.payload.theme || "Theme";
    const formatLabel = result.payload.format ? result.payload.format.toUpperCase() : "PNG";
    return `${locationLabel} | ${themeLabel} | ${formatLabel}`;
  }, [result]);

  const hasOutputs = Boolean(result && result.outputs.length > 0);
  const detailsHref = result?.payload.theme ? `/details?theme=${encodeURIComponent(result.payload.theme)}` : "/details";

  return (
    <section className="result-shell" aria-label="Generated poster result">
      <header className="section-header">
        <p className="eyebrow">Step 4</p>
        <h1>{result ? "Your poster is ready" : "No generated poster found yet"}</h1>
        <p>
          {result
            ? "Download the generated file or generate another variation."
            : "Generate a poster first, then this page will show your files here."}
        </p>
      </header>

      {error ? <p className="error-copy">{error}</p> : null}

      {result ? (
        <>
          <p className="summary-banner">{summary}</p>

          {hasOutputs ? (
            <section className="result-grid">
              {result.outputs.map((output) => (
                <article key={output.relativePath} className="result-card">
                  {output.previewUrl ? (
                    <img src={output.previewUrl} alt={output.fileName} className="result-image" />
                  ) : (
                    <div className="result-file-badge">{output.format.toUpperCase()} file</div>
                  )}

                  <div className="result-card-body">
                    <p>{output.fileName}</p>
                    <a href={output.downloadUrl} target="_blank" rel="noreferrer">
                      Open / Download
                    </a>
                  </div>
                </article>
              ))}
            </section>
          ) : (
            <p className="helper-note">This run completed but no downloadable files were saved.</p>
          )}

          {result.logs ? (
            <details className="logs">
              <summary>Generator logs</summary>
              <pre>{result.logs}</pre>
            </details>
          ) : null}
        </>
      ) : (
        <p className="loading-copy">Start from Themes or Details to generate a new poster.</p>
      )}

      <div className="result-actions">
        <Link href="/">Back to Themes</Link>
        <Link href={detailsHref}>{result ? "Create Another Poster" : "Go to Details"}</Link>
      </div>
    </section>
  );
}
