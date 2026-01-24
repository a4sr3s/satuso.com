import { calculateSpinScore } from './spin-score';

/**
 * Workboard Formula Fields Engine
 *
 * Defines computed/formula fields that can be used in workboards.
 * Some formulas are computed in SQL, others are post-processed in JS.
 */

export type FormulaType = 'days_in_stage' | 'sla_breach' | 'spin_score' | 'last_activity_days';

export interface FormulaDefinition {
  name: FormulaType;
  label: string;
  description: string;
  entityTypes: ('deals' | 'contacts' | 'companies')[];
  // SQL expression to include in SELECT, or null if post-processed
  sqlExpression: string | null;
  // SQL table aliases this formula requires
  requiredJoins?: string[];
  // Post-process function for JS computation
  postProcess?: (row: Record<string, any>) => any;
}

/**
 * Formula field definitions
 */
export const FORMULA_DEFINITIONS: Record<FormulaType, FormulaDefinition> = {
  days_in_stage: {
    name: 'days_in_stage',
    label: 'Days in Stage',
    description: 'Number of days the deal has been in its current stage',
    entityTypes: ['deals'],
    sqlExpression: "CAST((julianday('now') - julianday(d.stage_changed_at)) AS INTEGER)",
  },

  sla_breach: {
    name: 'sla_breach',
    label: 'SLA Breach',
    description: 'Whether the deal has breached SLA (14+ days in proposal stage)',
    entityTypes: ['deals'],
    sqlExpression: `CASE
      WHEN d.stage = 'proposal' AND (julianday('now') - julianday(d.stage_changed_at)) > 14
      THEN 1
      ELSE 0
    END`,
  },

  spin_score: {
    name: 'spin_score',
    label: 'SPIN Score',
    description: 'Calculated SPIN methodology completion score (0-100)',
    entityTypes: ['deals'],
    sqlExpression: null, // Post-processed
    postProcess: (row) => {
      const result = calculateSpinScore({
        spin_situation: row.spin_situation,
        spin_problem: row.spin_problem,
        spin_implication: row.spin_implication,
        spin_need_payoff: row.spin_need_payoff,
      });
      return result.score;
    },
  },

  last_activity_days: {
    name: 'last_activity_days',
    label: 'Days Since Last Activity',
    description: 'Number of days since the last activity was logged',
    entityTypes: ['deals', 'contacts', 'companies'],
    sqlExpression: null, // Handled via subquery in the main query builder
  },
};

/**
 * Build SQL SELECT fragments for formula columns
 */
export function getFormulaSelectFragments(
  formulas: FormulaType[],
  entityType: 'deals' | 'contacts' | 'companies'
): string[] {
  const fragments: string[] = [];

  for (const formula of formulas) {
    const def = FORMULA_DEFINITIONS[formula];
    if (!def || !def.entityTypes.includes(entityType)) continue;

    if (def.sqlExpression) {
      fragments.push(`${def.sqlExpression} as ${formula}`);
    }
  }

  return fragments;
}

/**
 * Post-process rows to compute JS formula fields
 */
export function postProcessFormulas(
  rows: Record<string, any>[],
  formulas: FormulaType[],
  entityType: 'deals' | 'contacts' | 'companies'
): Record<string, any>[] {
  const postProcessors = formulas
    .map((f) => FORMULA_DEFINITIONS[f])
    .filter((def) => def && def.postProcess && def.entityTypes.includes(entityType));

  if (postProcessors.length === 0) return rows;

  return rows.map((row) => {
    const newRow = { ...row };
    for (const def of postProcessors) {
      if (def.postProcess) {
        newRow[def.name] = def.postProcess(row);
      }
    }
    return newRow;
  });
}

/**
 * Get the last_activity_days subquery for a given entity type
 */
export function getLastActivitySubquery(entityType: 'deals' | 'contacts' | 'companies'): string {
  const alias = entityType === 'deals' ? 'd' : entityType === 'contacts' ? 'c' : 'co';
  const idField = entityType === 'deals' ? 'deal_id' : entityType === 'contacts' ? 'contact_id' : 'company_id';

  return `COALESCE(
    CAST((julianday('now') - julianday((
      SELECT MAX(created_at) FROM activities WHERE ${idField} = ${alias}.id
    ))) AS INTEGER),
    999
  )`;
}

/**
 * Parse workboard columns to extract formula types
 */
export function extractFormulasFromColumns(columns: { type: string; formula?: string }[]): FormulaType[] {
  const formulas: FormulaType[] = [];
  for (const col of columns) {
    if (col.type === 'formula' && col.formula) {
      if (col.formula in FORMULA_DEFINITIONS) {
        formulas.push(col.formula as FormulaType);
      }
    }
  }
  return [...new Set(formulas)];
}

/**
 * Filter operator definitions for workboard filters
 */
export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'is_null'
  | 'is_not_null'
  | 'in'
  | 'not_in';

export interface WorkboardFilter {
  field: string;
  operator: FilterOperator;
  value: any;
}

/**
 * Build SQL WHERE clause from filters
 */
export function buildFilterClause(
  filters: WorkboardFilter[],
  entityType: 'deals' | 'contacts' | 'companies'
): { clause: string; params: any[] } {
  if (!filters || filters.length === 0) {
    return { clause: '', params: [] };
  }

  const conditions: string[] = [];
  const params: any[] = [];
  const alias = entityType === 'deals' ? 'd' : entityType === 'contacts' ? 'c' : 'co';

  // Map aliased columns to their actual SQL references
  const aliasedFieldMap: Record<string, string> = {
    owner_name: 'u.name',
    company_name: entityType === 'deals' ? 'co.name' : entityType === 'contacts' ? 'co.name' : 'co.name',
    contact_name: 'c.name',
  };

  for (const filter of filters) {
    const fieldName = aliasedFieldMap[filter.field]
      || (filter.field.includes('.') ? filter.field : `${alias}.${filter.field}`);

    // Handle formula fields specially
    if (filter.field in FORMULA_DEFINITIONS) {
      const def = FORMULA_DEFINITIONS[filter.field as FormulaType];
      if (def.sqlExpression) {
        const expr = buildOperatorExpression(`(${def.sqlExpression})`, filter.operator, filter.value);
        if (expr) {
          conditions.push(expr.condition);
          params.push(...expr.params);
        }
      } else if (filter.field === 'spin_score') {
        // spin_score is post-processed, so filter after fetch
        // Skip SQL filtering, handle in post-process
        continue;
      } else if (filter.field === 'last_activity_days') {
        const subquery = getLastActivitySubquery(entityType);
        const expr = buildOperatorExpression(`(${subquery})`, filter.operator, filter.value);
        if (expr) {
          conditions.push(expr.condition);
          params.push(...expr.params);
        }
      }
      continue;
    }

    const expr = buildOperatorExpression(fieldName, filter.operator, filter.value);
    if (expr) {
      conditions.push(expr.condition);
      params.push(...expr.params);
    }
  }

  return {
    clause: conditions.length > 0 ? ` AND ${conditions.join(' AND ')}` : '',
    params,
  };
}

function buildOperatorExpression(
  fieldExpr: string,
  operator: FilterOperator,
  value: any
): { condition: string; params: any[] } | null {
  switch (operator) {
    case 'eq':
      return { condition: `${fieldExpr} = ?`, params: [value] };
    case 'neq':
      return { condition: `${fieldExpr} != ?`, params: [value] };
    case 'gt':
      return { condition: `${fieldExpr} > ?`, params: [value] };
    case 'gte':
      return { condition: `${fieldExpr} >= ?`, params: [value] };
    case 'lt':
      return { condition: `${fieldExpr} < ?`, params: [value] };
    case 'lte':
      return { condition: `${fieldExpr} <= ?`, params: [value] };
    case 'contains':
      return { condition: `${fieldExpr} LIKE ?`, params: [`%${value}%`] };
    case 'not_contains':
      return { condition: `${fieldExpr} NOT LIKE ?`, params: [`%${value}%`] };
    case 'starts_with':
      return { condition: `${fieldExpr} LIKE ?`, params: [`${value}%`] };
    case 'ends_with':
      return { condition: `${fieldExpr} LIKE ?`, params: [`%${value}`] };
    case 'is_null':
      return { condition: `${fieldExpr} IS NULL`, params: [] };
    case 'is_not_null':
      return { condition: `${fieldExpr} IS NOT NULL`, params: [] };
    case 'in':
      if (!Array.isArray(value) || value.length === 0) return null;
      const placeholders = value.map(() => '?').join(', ');
      return { condition: `${fieldExpr} IN (${placeholders})`, params: value };
    case 'not_in':
      if (!Array.isArray(value) || value.length === 0) return null;
      const notPlaceholders = value.map(() => '?').join(', ');
      return { condition: `${fieldExpr} NOT IN (${notPlaceholders})`, params: value };
    default:
      return null;
  }
}

/**
 * Post-process spin_score filter after rows are fetched
 */
export function filterBySpinScore(
  rows: Record<string, any>[],
  filters: WorkboardFilter[]
): Record<string, any>[] {
  const spinFilters = filters.filter((f) => f.field === 'spin_score');
  if (spinFilters.length === 0) return rows;

  return rows.filter((row) => {
    const score = row.spin_score;
    return spinFilters.every((filter) => {
      switch (filter.operator) {
        case 'eq':
          return score === filter.value;
        case 'neq':
          return score !== filter.value;
        case 'gt':
          return score > filter.value;
        case 'gte':
          return score >= filter.value;
        case 'lt':
          return score < filter.value;
        case 'lte':
          return score <= filter.value;
        default:
          return true;
      }
    });
  });
}
