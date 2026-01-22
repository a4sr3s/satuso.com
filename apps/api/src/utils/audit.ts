/**
 * Audit logging for security-sensitive operations.
 * Logs are structured for compliance and forensic analysis.
 */

import type { D1Database } from '@cloudflare/workers-types';

export type AuditAction =
  | 'user.login'
  | 'user.login_failed'
  | 'user.logout'
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'user.password_changed'
  | 'org.created'
  | 'org.updated'
  | 'org.deleted'
  | 'org.member_added'
  | 'org.member_removed'
  | 'org.member_role_changed'
  | 'invite.created'
  | 'invite.accepted'
  | 'invite.revoked'
  | 'deal.created'
  | 'deal.deleted'
  | 'contact.created'
  | 'contact.deleted'
  | 'company.created'
  | 'company.deleted'
  | 'data.exported'
  | 'api.rate_limited';

interface AuditEntry {
  action: AuditAction;
  userId?: string;
  orgId?: string;
  targetId?: string;
  targetType?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log an audit event to the database.
 * Falls back to console logging if database write fails.
 */
export async function logAudit(db: D1Database, entry: AuditEntry): Promise<void> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  // Sanitize metadata to prevent storing sensitive data
  const sanitizedMetadata = entry.metadata ? sanitizeMetadata(entry.metadata) : null;

  try {
    await db.prepare(`
      INSERT INTO audit_logs (id, action, user_id, org_id, target_id, target_type, metadata, ip_address, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      entry.action,
      entry.userId || null,
      entry.orgId || null,
      entry.targetId || null,
      entry.targetType || null,
      sanitizedMetadata ? JSON.stringify(sanitizedMetadata) : null,
      entry.ipAddress || null,
      entry.userAgent ? entry.userAgent.substring(0, 500) : null, // Truncate user agent
      now
    ).run();
  } catch (error) {
    // If database logging fails, fall back to console (structured)
    console.error(JSON.stringify({
      timestamp: now,
      level: 'error',
      message: 'Audit log write failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      auditEntry: {
        id,
        action: entry.action,
        userId: entry.userId,
        orgId: entry.orgId,
        targetId: entry.targetId,
        targetType: entry.targetType,
      },
    }));
  }
}

/**
 * Sanitize metadata to remove sensitive fields
 */
function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization', 'cookie'];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'string' && value.length > 200) {
      sanitized[key] = value.substring(0, 200) + '...[truncated]';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Helper to create audit logger bound to a request context
 */
export function createAuditLogger(db: D1Database, userId?: string, orgId?: string, ipAddress?: string, userAgent?: string) {
  return {
    log(action: AuditAction, targetId?: string, targetType?: string, metadata?: Record<string, unknown>) {
      return logAudit(db, {
        action,
        userId,
        orgId,
        targetId,
        targetType,
        metadata,
        ipAddress,
        userAgent,
      });
    },
  };
}
