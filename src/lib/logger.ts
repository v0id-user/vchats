type LogLevel = "info" | "warn" | "error" | "debug";

interface LogContext {
  service?: string;
  operation?: string;
  [key: string]: unknown;
}

// Fields that should be redacted from logs
const SENSITIVE_FIELDS = new Set([
  "password",
  "passwordHash",
  "token",
  "authorization",
  "cookie",
  "auth",
  "credentials",
  "secret",
  "apiKey",
  "accessToken",
  "refreshToken",
]);

/**
 * Recursively redacts sensitive fields from an object
 */
function redactSensitiveData(obj: unknown, depth = 0): unknown {
  // Prevent infinite recursion
  if (depth > 10) {
    return "[MAX_DEPTH]";
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveData(item, depth + 1));
  }

  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // Check if this key matches any sensitive field pattern
    const isSensitive = Array.from(SENSITIVE_FIELDS).some((field) =>
      lowerKey.includes(field.toLowerCase())
    );

    if (isSensitive) {
      redacted[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      redacted[key] = redactSensitiveData(value, depth + 1);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Formats log message with context
 */
function formatLogMessage(
  level: LogLevel,
  message: string,
  context?: LogContext
): string {
  const timestamp = new Date().toISOString();
  const contextStr = context
    ? ` [${context.service || "app"}${context.operation ? `:${context.operation}` : ""}]`
    : "";

  const dataStr = context
    ? ` ${JSON.stringify(redactSensitiveData(context))}`
    : "";

  return `[${timestamp}] [${level.toUpperCase()}]${contextStr} ${message}${dataStr}`;
}

/**
 * Logger utility with sensitive data redaction
 */
export const logger = {
  info(message: string, context?: LogContext): void {
    console.log(formatLogMessage("info", message, context));
  },

  warn(message: string, context?: LogContext): void {
    console.warn(formatLogMessage("warn", message, context));
  },

  error(message: string, context?: LogContext): void {
    console.error(formatLogMessage("error", message, context));
  },

  debug(message: string, context?: LogContext): void {
    // Only log debug in development
    if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
      console.debug(formatLogMessage("debug", message, context));
    }
  },
};

/**
 * Create a scoped logger for a specific service
 */
export function createScopedLogger(service: string) {
  return {
    info(operation: string, message: string, context?: Omit<LogContext, "service" | "operation">): void {
      logger.info(message, { service, operation, ...context });
    },

    warn(operation: string, message: string, context?: Omit<LogContext, "service" | "operation">): void {
      logger.warn(message, { service, operation, ...context });
    },

    error(operation: string, message: string, context?: Omit<LogContext, "service" | "operation">): void {
      logger.error(message, { service, operation, ...context });
    },

    debug(operation: string, message: string, context?: Omit<LogContext, "service" | "operation">): void {
      logger.debug(message, { service, operation, ...context });
    },
  };
}

