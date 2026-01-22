import { cors } from 'hono/cors';
import type { Env } from '../types';

/**
 * Explicitly allowed origins - no wildcards for security
 * Add new subdomains here as needed
 */
const PRODUCTION_ORIGINS = [
  'https://satuso.com',
  'https://www.satuso.com',
  'https://app.satuso.com',
] as const;

const DEVELOPMENT_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173', // Vite preview
] as const;

/**
 * Create CORS middleware with environment-aware origin configuration
 * Uses explicit origin allowlist - no wildcards
 */
export function createCorsMiddleware(env: Env) {
  const isProduction = env.ENVIRONMENT === 'production';
  const allowedOrigins: string[] = isProduction
    ? [...PRODUCTION_ORIGINS]
    : [...PRODUCTION_ORIGINS, ...DEVELOPMENT_ORIGINS];

  return cors({
    origin: (origin) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin) return PRODUCTION_ORIGINS[0];

      // Strict check against explicit allowlist - no wildcards
      if (allowedOrigins.includes(origin)) {
        return origin;
      }

      // Reject unknown origins by returning null
      // This will cause the browser to block the request
      return null;
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 86400,
    credentials: true,
  });
}

/**
 * Default CORS middleware
 * In production, this should be replaced with createCorsMiddleware(env)
 * but we include production origins by default for safety
 */
export const corsMiddleware = cors({
  origin: (origin) => {
    if (!origin) return PRODUCTION_ORIGINS[0];

    // Allow production origins always
    if ((PRODUCTION_ORIGINS as readonly string[]).includes(origin)) {
      return origin;
    }

    // Allow development origins only if they look like localhost
    // This is a fallback - prefer using createCorsMiddleware(env)
    if (origin.startsWith('http://localhost:')) {
      return origin;
    }

    return null;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 86400,
  credentials: true,
});
