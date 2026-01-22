/**
 * Cryptographic utilities for secure token generation
 */

/**
 * Generate a cryptographically secure random token
 * Uses Web Crypto API which is available in Cloudflare Workers
 * @param length - Number of bytes (will be hex encoded, so final string is 2x length)
 * @returns Hex-encoded random string
 */
export function generateSecureToken(length: number = 32): string {
  const buffer = new Uint8Array(length);
  crypto.getRandomValues(buffer);
  return Array.from(buffer)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a secure invite token
 * 32 bytes = 256 bits of entropy, hex encoded to 64 characters
 */
export function generateInviteToken(): string {
  return generateSecureToken(32);
}

/**
 * Generate a secure session token
 * 48 bytes = 384 bits of entropy
 */
export function generateSessionToken(): string {
  return generateSecureToken(48);
}
