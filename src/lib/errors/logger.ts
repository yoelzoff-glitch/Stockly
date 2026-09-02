import { AppError } from "./AppError";
import { sanitizeLogData } from "@/lib/observability/sanitizer";

export type LogLevel = "info" | "warn" | "error" | "debug";

export interface StructuredLogPayload {
  event?: string;
  correlationId?: string;
  tenantId?: string;
  operation?: string;
  source?: string;
  durationMs?: number;
  status?: string;
  errorCode?: string;
  error?: Error | AppError | unknown;
  message?: string;
  [key: string]: any;
}

function formatLogMessage(
  level: LogLevel,
  input: string | StructuredLogPayload | Error | unknown,
  extra?: any
): { logLine: string; rawObject?: any } {
  const timestamp = new Date().toISOString();

  // If structured object was provided as first argument (and not an Error instance)
  if (typeof input === "object" && input !== null && !(input instanceof Error)) {
    const sanitized = sanitizeLogData(input) as Record<string, any>;
    const eventName = sanitized.event || sanitized.operation || "LOG";
    const tenantStr = sanitized.tenantId ? ` [tenant:${sanitized.tenantId}]` : "";
    const corrStr = sanitized.correlationId ? ` [corr:${sanitized.correlationId}]` : "";
    const msg = sanitized.message || "";
    
    return {
      logLine: `[${timestamp}] [${level.toUpperCase()}] [${eventName}]${tenantStr}${corrStr} ${msg}`.trim(),
      rawObject: sanitized,
    };
  }

  // Legacy string or Error input
  if (input instanceof AppError) {
    const contextStr = typeof extra === "string" ? ` [${extra}]` : "";
    const sanitizedDetails = extra && typeof extra !== "string" ? sanitizeLogData(extra) : (input.details ? sanitizeLogData(input.details) : undefined);
    return {
      logLine: `[${timestamp}] [${level.toUpperCase()}] [${input.code}]${contextStr} ${input.message}`,
      rawObject: sanitizedDetails,
    };
  }

  if (input instanceof Error) {
    const contextStr = typeof extra === "string" ? ` [${extra}]` : "";
    const sanitizedExtra = extra && typeof extra !== "string" ? sanitizeLogData(extra) : undefined;
    return {
      logLine: `[${timestamp}] [${level.toUpperCase()}]${contextStr} ${input.message}`,
      rawObject: sanitizedExtra || input.stack,
    };
  }

  // Primitive string / message
  const msg = String(input);
  const contextStr = typeof extra === "string" ? ` [${extra}]` : "";
  const sanitizedDetails = extra && typeof extra !== "string" ? sanitizeLogData(extra) : undefined;

  return {
    logLine: `[${timestamp}] [${level.toUpperCase()}]${contextStr} ${msg}`,
    rawObject: sanitizedDetails,
  };
}

export const logger = {
  error: (errOrPayload: Error | AppError | StructuredLogPayload | unknown, contextOrDetails?: any) => {
    try {
      const { logLine, rawObject } = formatLogMessage("error", errOrPayload, contextOrDetails);
      console.error(logLine);
      if (rawObject) console.error("Details:", rawObject);
    } catch {
      // Best-effort safety fallback
      console.error("[ERROR] Failed to format log safely");
    }
  },

  warn: (messageOrPayload: string | StructuredLogPayload, details?: any) => {
    try {
      const { logLine, rawObject } = formatLogMessage("warn", messageOrPayload, details);
      console.warn(logLine);
      if (rawObject) console.warn("Details:", rawObject);
    } catch {
      console.warn("[WARN] Failed to format log safely");
    }
  },

  info: (messageOrPayload: string | StructuredLogPayload, details?: any) => {
    try {
      const { logLine, rawObject } = formatLogMessage("info", messageOrPayload, details);
      console.info(logLine);
      if (rawObject) console.info("Details:", rawObject);
    } catch {
      console.info("[INFO] Failed to format log safely");
    }
  },

  debug: (messageOrPayload: string | StructuredLogPayload, details?: any) => {
    try {
      const { logLine, rawObject } = formatLogMessage("debug", messageOrPayload, details);
      console.debug(logLine);
      if (rawObject) console.debug("Details:", rawObject);
    } catch {
      console.debug("[DEBUG] Failed to format log safely");
    }
  },
};
