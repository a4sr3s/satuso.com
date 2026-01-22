import { Context, Next } from 'hono';
import type { Env, Variables } from '../types';

/**
 * Security headers middleware
 * Adds important security headers to all API responses
 */
export async function securityHeadersMiddleware(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) {
  await next();

  // Strict Transport Security - enforce HTTPS for 1 year
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // Prevent MIME type sniffing
  c.header('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  c.header('X-Frame-Options', 'DENY');

  // XSS protection (legacy browsers)
  c.header('X-XSS-Protection', '1; mode=block');

  // Referrer policy - don't leak URLs
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy for API responses
  // This is a restrictive CSP since we're an API (no scripts, no frames, etc.)
  c.header(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'"
  );

  // Permissions Policy - disable unnecessary features
  c.header(
    'Permissions-Policy',
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
  );
}
