import { cors } from 'hono/cors';
import type { Env } from '../_types';

/**
 * Create CORS middleware with environment-aware origin configuration
 * Only allows localhost in development environments
 */
export function createCorsMiddleware(env: Env) {
  const isProduction = env.ENVIRONMENT === 'production';

  // Production origins only
  const productionOrigins = [
    'https://satuso.com',
    'https://www.satuso.com',
    'https://app.satuso.com',
  ];

  // Development includes localhost
  const developmentOrigins = [
    ...productionOrigins,
    'http://localhost:5173',
    'http://localhost:3000',
  ];

  const allowedOrigins = isProduction ? productionOrigins : developmentOrigins;

  return cors({
    origin: (origin) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return productionOrigins[0];

      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        return origin;
      }

      // Check for subdomain pattern in production
      if (origin.match(/^https:\/\/[\w-]+\.satuso\.com$/)) {
        return origin;
      }

      // Default to main domain
      return productionOrigins[0];
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 86400,
    credentials: true,
  });
}

// Legacy export for backwards compatibility - defaults to development
export const corsMiddleware = cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'https://satuso.com', 'https://www.satuso.com', 'https://app.satuso.com'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 86400,
  credentials: true,
});
