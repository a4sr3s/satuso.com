/**
 * Pagination utilities with validation to prevent DoS attacks
 */

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;
const DEFAULT_PAGE = 1;

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

/**
 * Parse and validate pagination parameters from query string
 * Prevents DoS attacks by capping limit and ensuring valid ranges
 */
export function parsePagination(query: { page?: string; limit?: string }): PaginationParams {
  const page = Math.max(DEFAULT_PAGE, parseInt(query.page || '', 10) || DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit || '', 10) || DEFAULT_LIMIT));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}
