import { LOG_LEVEL } from "@/app/_lib/poster/constants";

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

function normalizeLogLevel(input: string): LogLevel {
  const value = input.trim().toLowerCase();
  if (value === "debug" || value === "info" || value === "warn" || value === "error") {
    return value;
  }
  return "info";
}

const activeLevel = normalizeLogLevel(LOG_LEVEL);

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[activeLevel];
}

function emit(level: LogLevel, message: string, meta?: unknown): void {
  if (!shouldLog(level)) {
    return;
  }

  const line = `[poster][${new Date().toISOString()}][${level.toUpperCase()}] ${message}`;

  if (meta === undefined) {
    if (level === "warn") {
      console.warn(line);
      return;
    }
    if (level === "error") {
      console.error(line);
      return;
    }
    if (level === "debug") {
      console.debug(line);
      return;
    }
    console.info(line);
    return;
  }

  if (level === "warn") {
    console.warn(line, meta);
    return;
  }
  if (level === "error") {
    console.error(line, meta);
    return;
  }
  if (level === "debug") {
    console.debug(line, meta);
    return;
  }
  console.info(line, meta);
}

export const logger = {
  level: activeLevel,
  debug(message: string, meta?: unknown) {
    emit("debug", message, meta);
  },
  info(message: string, meta?: unknown) {
    emit("info", message, meta);
  },
  warn(message: string, meta?: unknown) {
    emit("warn", message, meta);
  },
  error(message: string, meta?: unknown) {
    emit("error", message, meta);
  }
};

