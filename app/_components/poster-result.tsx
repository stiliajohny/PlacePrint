"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { JOURNEY_RESULT_STORAGE_KEY, type JourneyResult } from "@/app/_lib/poster/journey-storage";

export function PosterResult() {
  const [result, setResult] = useState<JourneyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(JOURNEY_RESULT_STORAGE_KEY);
      if (!raw) {
        setError("No generated result found in this browser session.");
        return;
      }

      const parsed = JSON.parse(raw) as JourneyResult;
      setResult(parsed);
    } catch {
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

    return `${locationLabel} | ${result.payload.theme} | ${result.payload.format.toUpperCase()}`;
  }, [result]);

  return (
    <section className="result-shell" aria-label="Generated poster result">
      <header className="section-header">
        <p className="eyebrow">Step 4</p>
        <h1>Your poster is ready</h1>
        <p>Download the generated file or generate another variation.</p>
      </header>

      {error ? <p className="error-copy">{error}</p> : null}

      {result ? (
        <>
          <p className="summary-banner">{summary}</p>

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

          {result.logs ? (
            <details className="logs">
              <summary>Generator logs</summary>
              <pre>{result.logs}</pre>
            </details>
          ) : null}
        </>
      ) : null}

      <div className="result-actions">
        <Link href="/">Back to Themes</Link>
        {result ? <Link href={`/details?theme=${encodeURIComponent(result.payload.theme)}`}>Create Another Poster</Link> : null}
      </div>
    </section>
  );
}
