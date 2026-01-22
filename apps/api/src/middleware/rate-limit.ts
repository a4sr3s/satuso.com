import { Context, Next } from 'hono';
import type { Env, Variables } from '../types';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyPrefix?: string;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 60 * 1000, // 1 minute
  keyPrefix: 'rate:',
};

/**
 * Rate limiting middleware using Cloudflare KV
 * Limits requests per user (if authenticated) or per IP
 */
export function rateLimiter(config: Partial<RateLimitConfig> = {}) {
  const { maxRequests, windowMs, keyPrefix } = { ...DEFAULT_CONFIG, ...config };

  return async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
    // In development, use much higher limits but don't skip entirely
    // This ensures rate limiting logic is still tested
    // ENVIRONMENT is set via wrangler.toml and cannot be manipulated by clients
    const isDev = c.env.ENVIRONMENT === 'development';
    const effectiveMaxRequests = isDev ? maxRequests * 10 : maxRequests;

    // Get identifier - prefer user ID if authenticated, fallback to IP
    const userId = c.get('userId');
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const identifier = userId || ip;

    const key = `${keyPrefix}${identifier}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      // Get current rate limit data from KV
      const data = await c.env.KV.get(key, 'json') as { requests: number[]; } | null;

      // Filter to only requests within the current window
      const requests = data?.requests?.filter((t: number) => t > windowStart) || [];

      if (requests.length >= effectiveMaxRequests) {
        // Calculate retry-after time
        const oldestRequest = Math.min(...requests);
        const retryAfter = Math.ceil((oldestRequest + windowMs - now) / 1000);

        return c.json(
          {
            success: false,
            error: 'Too many requests. Please try again later.',
          },
          429,
          {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': effectiveMaxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.ceil((oldestRequest + windowMs) / 1000).toString(),
          }
        );
      }

      // Add current request and store back to KV
      requests.push(now);
      await c.env.KV.put(key, JSON.stringify({ requests }), {
        expirationTtl: Math.ceil(windowMs / 1000) + 60, // Add buffer to TTL
      });

      // Add rate limit headers
      c.header('X-RateLimit-Limit', effectiveMaxRequests.toString());
      c.header('X-RateLimit-Remaining', (effectiveMaxRequests - requests.length).toString());

      return next();
    } catch (error) {
      // If rate limiting fails, allow the request but log the error
      console.error('Rate limiting error:', error);
      return next();
    }
  };
}

/**
 * Stricter rate limiter for sensitive endpoints (auth, AI)
 */
export const strictRateLimiter = rateLimiter({
  maxRequests: 10,
  windowMs: 60 * 1000, // 10 requests per minute
  keyPrefix: 'rate:strict:',
});

/**
 * Standard rate limiter for API endpoints
 */
export const standardRateLimiter = rateLimiter({
  maxRequests: 100,
  windowMs: 60 * 1000, // 100 requests per minute
  keyPrefix: 'rate:api:',
});

/**
 * Lenient rate limiter for read-heavy endpoints
 */
export const readRateLimiter = rateLimiter({
  maxRequests: 200,
  windowMs: 60 * 1000, // 200 requests per minute
  keyPrefix: 'rate:read:',
});
