/**
 * Structured JSON logger — lightweight, zero-dependency.
 * In production (Vercel), JSON logs are ingested by log drains / Sentry.
 * In development, pretty-prints with timestamps.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

function formatLog(entry: LogEntry): string {
  if (isProd()) {
    return JSON.stringify(entry);
  }
  // Development: pretty-print
  const { level, message, timestamp, ...rest } = entry;
  const keys = Object.keys(rest);
  const extra = keys.length > 0 ? " " + JSON.stringify(rest) : "";
  const levelPad = level.toUpperCase().padEnd(5);
  return `[${timestamp}] ${levelPad} ${message}${extra}`;
}

function createEntry(level: LogLevel, message: string, meta?: Record<string, unknown>): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };
}

function emit(entry: LogEntry): void {
  const line = formatLog(entry);
  if (entry.level === "error") {
    console.error(line);
  } else if (entry.level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>) {
    if (!isProd()) emit(createEntry("debug", message, meta));
  },
  info(message: string, meta?: Record<string, unknown>) {
    emit(createEntry("info", message, meta));
  },
  warn(message: string, meta?: Record<string, unknown>) {
    emit(createEntry("warn", message, meta));
  },
  error(message: string, meta?: Record<string, unknown>) {
    emit(createEntry("error", message, meta));
  },
};
