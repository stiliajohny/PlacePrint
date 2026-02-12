"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  JOURNEY_PAYLOAD_STORAGE_KEY,
  JOURNEY_RESULT_STORAGE_KEY,
  parseStoredJourneyPayload,
  parseStoredJourneyResult,
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

function safeSessionGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSessionRemove(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Ignore storage cleanup failures.
  }
}

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

      const payloadRead = parseStoredJourneyPayload(safeSessionGet(JOURNEY_PAYLOAD_STORAGE_KEY));
      if (!payloadRead.data) {
        if (!isCancelled) {
          setError(payloadRead.error ?? "Could not read generation details.");
          setErrorDetails([]);
          setErrorTechnical(null);
          setIsRunning(false);
        }
        return;
      }
      const parsedPayload: JourneyPayload = payloadRead.data;

      const hasLocation = Boolean(
        (parsedPayload.city && parsedPayload.country) ||
          (parsedPayload.latitude && parsedPayload.longitude)
      );
      if (!parsedPayload.theme || !hasLocation) {
        if (!isCancelled) {
          setError("Generation details are incomplete. Go back to Step 2 and confirm required fields.");
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
      const existingLock = safeSessionGet(JOURNEY_GENERATION_LOCK_KEY);
      if (existingLock) {
        const pollStart = Date.now();
        pollTimer = window.setInterval(() => {
          if (isCancelled) {
            return;
          }

          const rawResult = safeSessionGet(JOURNEY_RESULT_STORAGE_KEY);
          if (rawResult) {
            const parsedResult = parseStoredJourneyResult(rawResult);
            if (parsedResult.data && JSON.stringify(parsedResult.data.payload) === payloadSignature) {
              if (pollTimer !== null) {
                window.clearInterval(pollTimer);
              }
              pollTimer = null;
              router.replace("/result");
              return;
            }
          }

          if (Date.now() - pollStart > 180_000) {
            if (pollTimer !== null) {
              window.clearInterval(pollTimer);
            }
            pollTimer = null;
            safeSessionRemove(JOURNEY_GENERATION_LOCK_KEY);
            setError("Generation lock timed out. Please retry.");
            setErrorDetails([]);
            setErrorTechnical(null);
            setIsRunning(false);
          }
        }, 900);
        return;
      }

      try {
        sessionStorage.setItem(JOURNEY_GENERATION_LOCK_KEY, String(Date.now()));
      } catch {
        setError("Could not access this browser session. Enable storage and retry generation.");
        setErrorDetails([]);
        setErrorTechnical(null);
        setIsRunning(false);
        return;
      }

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

        try {
          sessionStorage.setItem(JOURNEY_RESULT_STORAGE_KEY, JSON.stringify(result));
        } catch {
          setError("Poster generated but could not save the result in this browser session.");
          setErrorDetails([]);
          setErrorTechnical(null);
          setIsRunning(false);
          return;
        }
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
        safeSessionRemove(JOURNEY_GENERATION_LOCK_KEY);
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

      {isRunning || payload ? (
        <div className="generating-panel">
          {isRunning ? <div className="spinner" aria-hidden="true" /> : null}
          <p className="generating-message">
            {isRunning ? LOADER_MESSAGES[messageIndex] : "Generation stopped before completion."}
          </p>
          {payload ? (
            <p className="generating-context">
              {payloadLocationLabel} | {payload.theme} | {Math.round(payload.width * 300)} x{" "}
              {Math.round(payload.height * 300)} px
            </p>
          ) : null}
        </div>
      ) : null}

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
