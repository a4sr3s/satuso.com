/**
 * Structured logging utility that sanitizes sensitive data.
 * Prevents accidental leakage of user data, credentials, or PII in logs.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  userId?: string;
  orgId?: string;
  action?: string;
  [key: string]: unknown;
}

// Fields that should never be logged
const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'api_key',
  'authorization',
  'cookie',
  'session',
  'credential',
  'email', // Avoid logging PII
  'phone',
  'message', // User messages to AI
  'content', // User content
  'transcript', // Call transcripts
  'body', // Request bodies
];

/**
 * Sanitize an object by removing sensitive keys
 */
function sanitize(obj: unknown, depth = 0): unknown {
  if (depth > 5) return '[nested]';

  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    // Truncate long strings
    if (obj.length > 200) {
      return obj.substring(0, 200) + '...[truncated]';
    }
    return obj;
  }

  if (typeof obj !== 'object') return obj;

  if (obj instanceof Error) {
    return {
      name: obj.name,
      message: sanitize(obj.message, depth + 1),
      // Don't include full stack trace which may contain file paths or data
    };
  }

  if (Array.isArray(obj)) {
    return obj.slice(0, 10).map((item) => sanitize(item, depth + 1));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some((sensitive) => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitize(value, depth + 1);
    }
  }
  return sanitized;
}

/**
 * Create a log entry with timestamp and level
 */
function createLogEntry(level: LogLevel, message: string, context?: LogContext) {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context ? { context: sanitize(context) } : {}),
  };
}

/**
 * Logger instance with structured, sanitized logging
 */
// Note: In Cloudflare Workers, debug logs are always enabled
// Production log filtering should be done at the log aggregation layer
export const logger = {
  debug(message: string, context?: LogContext) {
    console.debug(JSON.stringify(createLogEntry('debug', message, context)));
  },

  info(message: string, context?: LogContext) {
    console.log(JSON.stringify(createLogEntry('info', message, context)));
  },

  warn(message: string, context?: LogContext) {
    console.warn(JSON.stringify(createLogEntry('warn', message, context)));
  },

  error(message: string, error?: Error | unknown, context?: LogContext) {
    const entry = createLogEntry('error', message, context);
    if (error) {
      (entry as any).error = sanitize(error);
    }
    console.error(JSON.stringify(entry));
  },
};

/**
 * Create a request-scoped logger with userId and orgId context
 */
export function createRequestLogger(userId?: string, orgId?: string) {
  const baseContext = { userId, orgId };

  return {
    debug(message: string, context?: LogContext) {
      logger.debug(message, { ...baseContext, ...context });
    },
    info(message: string, context?: LogContext) {
      logger.info(message, { ...baseContext, ...context });
    },
    warn(message: string, context?: LogContext) {
      logger.warn(message, { ...baseContext, ...context });
    },
    error(message: string, error?: Error | unknown, context?: LogContext) {
      logger.error(message, error, { ...baseContext, ...context });
    },
  };
}
