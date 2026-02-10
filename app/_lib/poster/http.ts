import { HTTP_TIMEOUT_MS } from "@/app/_lib/poster/constants";
import { logger } from "@/app/_lib/poster/logger";

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = HTTP_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const method = init.method ?? "GET";
  const startedAt = Date.now();

  logger.debug("HTTP request started", { method, url, timeoutMs });

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store"
    });

    logger.debug("HTTP request completed", {
      method,
      url,
      status: response.status,
      durationMs: Date.now() - startedAt
    });
    return response;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    if (error instanceof Error && error.name === "AbortError") {
      const timeoutError = new Error(`Request timed out after ${timeoutMs}ms: ${method} ${url}`);
      logger.warn("HTTP request timed out", { method, url, timeoutMs, durationMs });
      throw timeoutError;
    }
    logger.warn("HTTP request failed", {
      method,
      url,
      durationMs,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
