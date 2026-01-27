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
  organization_id?: string;
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
  const tableMap: Record<string, string> = {
    contact: 'contacts',
    company: 'companies',
    deal: 'deals',
    task: 'tasks',
    activity: 'activities',
  };

  const table = tableMap[resourceType];

  // Check ownership and org membership
  const resource = await db
    .prepare(`SELECT owner_id FROM ${table} WHERE id = ?`)
    .bind(resourceId)
    .first<{ owner_id: string }>();

  if (!resource) {
    return false; // Resource doesn't exist
  }

  // Verify the resource belongs to the same organization
  // SECURITY: Always check organization boundary - never allow null org bypass
  const ownerOrg = await db
    .prepare('SELECT organization_id FROM users WHERE id = ?')
    .bind(resource.owner_id)
    .first<{ organization_id: string | null }>();

  // If user has an org, resource owner must be in same org
  // If user has no org, they can only access their own resources (checked below)
  if (user.organization_id) {
    if (ownerOrg?.organization_id !== user.organization_id) {
      return false; // Cross-org access denied
    }
  } else {
    // User without organization can ONLY access their own resources
    if (resource.owner_id !== user.id) {
      return false;
    }
  }

  // Admins have full access within their org
  if (user.role === 'admin') {
    return true;
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
 * All queries are scoped to the user's organization
 */
export function getAccessFilter(
  user: User,
  ownerIdColumn: string = 'owner_id'
): { sql: string; params: string[] } {
  // Always scope to organization first
  const orgFilter = user.organization_id
    ? ` AND ${ownerIdColumn} IN (SELECT id FROM users WHERE organization_id = ?)`
    : ` AND ${ownerIdColumn} = ?`;
  const orgParam = user.organization_id || user.id;

  // Admins see everything within their org
  if (user.role === 'admin') {
    return { sql: orgFilter, params: [orgParam] };
  }

  // Others see only their own resources
  return {
    sql: ` AND ${ownerIdColumn} = ?`,
    params: [user.id],
  };
}

/**
 * Get access filter for deals that includes deal_team membership
 * All queries are scoped to the user's organization
 */
export function getDealAccessFilter(user: User): { sql: string; params: string[] } {
  // Always scope to organization
  const orgFilter = user.organization_id
    ? ` AND d.owner_id IN (SELECT id FROM users WHERE organization_id = ?)`
    : ` AND d.owner_id = ?`;
  const orgParam = user.organization_id || user.id;

  // Admins see everything within their org
  if (user.role === 'admin') {
    return { sql: orgFilter, params: [orgParam] };
  }

  // Users see deals they own OR are team members of (still org-scoped)
  return {
    sql: `${orgFilter} AND (d.owner_id = ? OR d.id IN (SELECT deal_id FROM deal_team WHERE user_id = ?))`,
    params: [orgParam, user.id, user.id],
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
