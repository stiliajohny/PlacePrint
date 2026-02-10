"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  JOURNEY_PAYLOAD_STORAGE_KEY,
  JOURNEY_RESULT_STORAGE_KEY,
  type JourneyPayload,
  type JourneyResult
} from "@/app/_lib/poster/journey-storage";
import {
  buildGenerationFailure,
  readGenerateResponse
} from "@/app/_lib/poster/client-generation";

const LOADER_MESSAGES = [
  "Tracing road networks and water geometry...",
  "Balancing map crop and poster composition...",
  "Applying selected theme colors and stroke hierarchy...",
  "Rendering print-ready layout and labels...",
  "Finalizing export and preparing preview output..."
];

const JOURNEY_GENERATION_LOCK_KEY = "placeprint-journey-generation-lock";

export function PosterGenerating() {
  const router = useRouter();
  const [payload, setPayload] = useState<JourneyPayload | null>(null);
  const [messageIndex, setMessageIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string[]>([]);
  const [errorTechnical, setErrorTechnical] = useState<string | null>(null);
  const [runNonce, setRunNonce] = useState(0);

  const payloadLocationLabel = payload
    ? payload.city && payload.country
      ? `${payload.city}, ${payload.country}`
      : payload.latitude && payload.longitude
        ? `Coordinates ${payload.latitude}, ${payload.longitude}`
        : "Location"
    : "";

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const timer = window.setInterval(() => {
      setMessageIndex((previous) => (previous + 1) % LOADER_MESSAGES.length);
    }, 2200);

    return () => window.clearInterval(timer);
  }, [isRunning]);

  useEffect(() => {
    let isCancelled = false;
    let pollTimer: number | null = null;

    const runGeneration = async () => {
      setError(null);
      setErrorDetails([]);
      setErrorTechnical(null);
      setIsRunning(true);

      let parsedPayload: JourneyPayload;
      try {
        const rawPayload = sessionStorage.getItem(JOURNEY_PAYLOAD_STORAGE_KEY);
        if (!rawPayload) {
          throw new Error("No details found. Go back and complete Step 2.");
        }

        parsedPayload = JSON.parse(rawPayload) as JourneyPayload;
      } catch (payloadError) {
        if (!isCancelled) {
          setError(payloadError instanceof Error ? payloadError.message : "Could not read generation details.");
          setErrorDetails([]);
          setErrorTechnical(null);
          setIsRunning(false);
        }
        return;
      }

      if (!isCancelled) {
        setPayload(parsedPayload);
      }

      const payloadSignature = JSON.stringify(parsedPayload);
      const existingLock = sessionStorage.getItem(JOURNEY_GENERATION_LOCK_KEY);
      if (existingLock) {
        const pollStart = Date.now();
        pollTimer = window.setInterval(() => {
          if (isCancelled) {
            return;
          }

          const rawResult = sessionStorage.getItem(JOURNEY_RESULT_STORAGE_KEY);
          if (rawResult) {
            try {
              const parsedResult = JSON.parse(rawResult) as JourneyResult;
              if (JSON.stringify(parsedResult.payload) === payloadSignature) {
                if (pollTimer !== null) {
                  window.clearInterval(pollTimer);
                }
                pollTimer = null;
                router.replace("/result");
                return;
              }
            } catch {
              // Keep polling until a valid result is stored.
            }
          }

          if (Date.now() - pollStart > 180_000) {
            if (pollTimer !== null) {
              window.clearInterval(pollTimer);
            }
            pollTimer = null;
            sessionStorage.removeItem(JOURNEY_GENERATION_LOCK_KEY);
            setError("Generation lock timed out. Please retry.");
            setErrorDetails([]);
            setErrorTechnical(null);
            setIsRunning(false);
          }
        }, 900);
        return;
      }

      sessionStorage.setItem(JOURNEY_GENERATION_LOCK_KEY, String(Date.now()));

      try {
        const response = await fetch("/api/posters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...parsedPayload,
            allThemes: false
          })
        });

        const { data, rawText } = await readGenerateResponse(response);
        if (!response.ok) {
          const failure = buildGenerationFailure(response.status, data, rawText);
          setError(failure.message);
          setErrorDetails(failure.details);
          setErrorTechnical(failure.technical);
          setIsRunning(false);
          return;
        }

        if (!data) {
          setError("Poster generation failed: invalid server response.");
          setErrorDetails(["The API returned non-JSON output."]);
          setErrorTechnical(rawText.trim().slice(0, 8000) || null);
          setIsRunning(false);
          return;
        }

        const outputs = data.outputs ?? [];
        const result: JourneyResult = {
          payload: parsedPayload,
          outputs,
          logs: [data.logs, data.stderr].filter(Boolean).join("\n\n"),
          generatedAt: new Date().toISOString()
        };

        sessionStorage.setItem(JOURNEY_RESULT_STORAGE_KEY, JSON.stringify(result));
        if (!isCancelled) {
          router.replace("/result");
        }
      } catch (runError) {
        if (!isCancelled) {
          setError(runError instanceof Error ? runError.message : "Poster generation failed.");
          setErrorDetails([]);
          setErrorTechnical(null);
          setIsRunning(false);
        }
      } finally {
        sessionStorage.removeItem(JOURNEY_GENERATION_LOCK_KEY);
      }
    };

    void runGeneration();

    return () => {
      if (pollTimer !== null) {
        window.clearInterval(pollTimer);
      }
      isCancelled = true;
    };
  }, [router, runNonce]);

  return (
    <section className="generating-shell" aria-live="polite" aria-busy={isRunning}>
      <header className="section-header">
        <p className="eyebrow">Step 3</p>
        <h1>Generating your poster</h1>
        <p>We are running the map generation API now.</p>
      </header>

      <div className="generating-panel">
        <div className="spinner" aria-hidden="true" />
        <p className="generating-message">{LOADER_MESSAGES[messageIndex]}</p>
        {payload ? (
          <p className="generating-context">
            {payloadLocationLabel} | {payload.theme} | {Math.round(payload.width * 300)} x{" "}
            {Math.round(payload.height * 300)} px
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="generating-error">
          <p className="error-copy">{error}</p>
          {errorDetails.length > 0 ? (
            <ul className="error-details">
              {errorDetails.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          ) : null}
          {errorTechnical ? (
            <details className="logs">
              <summary>Technical details</summary>
              <pre>{errorTechnical}</pre>
            </details>
          ) : null}
          <div className="generating-actions">
            <button
              type="button"
              onClick={() => {
                setMessageIndex(0);
                setRunNonce((previous) => previous + 1);
              }}
            >
              Retry Generation
            </button>
            <Link className="ghost-link" href="/details">
              Back to Details
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  );
}
