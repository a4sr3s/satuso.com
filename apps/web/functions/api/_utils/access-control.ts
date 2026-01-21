/**
 * Row-level access control utilities
 * Ensures users can only access resources they own or are authorized to see
 */

import type { D1Database } from '@cloudflare/workers-types';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

/**
 * Check if a user can access a resource
 * - Admins can access all resources
 * - Owners can access their own resources
 * - Deal team members can access deals they're assigned to
 */
export async function canAccessResource(
  db: D1Database,
  user: User,
  resourceType: 'contact' | 'company' | 'deal' | 'task' | 'activity',
  resourceId: string
): Promise<boolean> {
  // Admins have full access
  if (user.role === 'admin') {
    return true;
  }

  const tableMap: Record<string, string> = {
    contact: 'contacts',
    company: 'companies',
    deal: 'deals',
    task: 'tasks',
    activity: 'activities',
  };

  const table = tableMap[resourceType];

  // Check ownership
  const resource = await db
    .prepare(`SELECT owner_id FROM ${table} WHERE id = ?`)
    .bind(resourceId)
    .first<{ owner_id: string }>();

  if (!resource) {
    return false; // Resource doesn't exist
  }

  if (resource.owner_id === user.id) {
    return true;
  }

  // For deals, also check deal_team membership
  if (resourceType === 'deal') {
    const teamMember = await db
      .prepare(`SELECT id FROM deal_team WHERE deal_id = ? AND user_id = ?`)
      .bind(resourceId, user.id)
      .first();

    if (teamMember) {
      return true;
    }
  }

  // For activities/tasks, check if user has access to the parent deal
  if (resourceType === 'activity' || resourceType === 'task') {
    const resourceWithDeal = await db
      .prepare(`SELECT deal_id FROM ${table} WHERE id = ?`)
      .bind(resourceId)
      .first<{ deal_id: string | null }>();

    if (resourceWithDeal?.deal_id) {
      return canAccessResource(db, user, 'deal', resourceWithDeal.deal_id);
    }
  }

  return false;
}

/**
 * Get a WHERE clause filter for listing resources
 * Returns SQL fragment and params array
 */
export function getAccessFilter(
  user: User,
  ownerIdColumn: string = 'owner_id'
): { sql: string; params: string[] } {
  // Admins see everything
  if (user.role === 'admin') {
    return { sql: '', params: [] };
  }

  // Others see only their own resources
  return {
    sql: ` AND ${ownerIdColumn} = ?`,
    params: [user.id],
  };
}

/**
 * Get access filter for deals that includes deal_team membership
 */
export function getDealAccessFilter(user: User): { sql: string; params: string[] } {
  // Admins see everything
  if (user.role === 'admin') {
    return { sql: '', params: [] };
  }

  // Users see deals they own OR are team members of
  return {
    sql: ` AND (d.owner_id = ? OR d.id IN (SELECT deal_id FROM deal_team WHERE user_id = ?))`,
    params: [user.id, user.id],
  };
}

/**
 * Assert user can access a resource, throw 403 if not
 */
export async function assertCanAccess(
  db: D1Database,
  user: User,
  resourceType: 'contact' | 'company' | 'deal' | 'task' | 'activity',
  resourceId: string
): Promise<void> {
  const hasAccess = await canAccessResource(db, user, resourceType, resourceId);
  if (!hasAccess) {
    throw new AccessDeniedError(`You don't have access to this ${resourceType}`);
  }
}

export class AccessDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccessDeniedError';
  }
}
