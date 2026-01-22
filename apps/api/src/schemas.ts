import { z } from 'zod';

// Password validation with complexity requirements
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

// Auth schemas
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: passwordSchema,
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
});

// Export for reuse in other schemas (e.g., accept-invite)
export { passwordSchema };

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Contact schemas
export const createContactSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().max(50, 'Phone is too long').optional(),
  title: z.string().max(100, 'Title is too long').optional(),
  companyId: z.string().optional(),
  ownerId: z.string().optional(),
  status: z.enum(['active', 'inactive', 'lead']).optional(),
  source: z.string().max(50, 'Source is too long').optional(),
  linkedinUrl: z.string().url('Invalid LinkedIn URL').optional().or(z.literal('')),
});

export const updateContactSchema = createContactSchema.partial();

// Company schemas
export const createCompanySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  domain: z.string().max(100, 'Domain is too long').optional(),
  industry: z.string().max(100, 'Industry is too long').optional(),
  employee_count: z.number().int().positive().optional(),
  website: z.string().url('Invalid website URL').optional().or(z.literal('')),
  description: z.string().max(1000, 'Description is too long').optional(),
  annual_revenue: z.number().positive().optional(),
});

export const updateCompanySchema = createCompanySchema.partial();

// Deal schemas
export const createDealSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  value: z.number().positive('Value must be positive').optional(),
  stage: z.enum(['lead', 'qualified', 'discovery', 'proposal', 'negotiation', 'closed_won', 'closed_lost']).optional(),
  close_date: z.string().optional(),
  company_id: z.string().optional(),
  contact_id: z.string().optional(),
});

export const updateDealSchema = createDealSchema.partial().extend({
  spinSituation: z.string().optional(),
  spinProblem: z.string().optional(),
  spinImplication: z.string().optional(),
  spinNeedPayoff: z.string().optional(),
});

export const moveDealSchema = z.object({
  stage: z.enum(['lead', 'qualified', 'discovery', 'proposal', 'negotiation', 'closed_won', 'closed_lost']),
});

// Deal Team schemas
export const addDealTeamMemberSchema = z.object({
  user_id: z.string().min(1, 'User ID is required'),
  role: z.enum(['owner', 'technical', 'executive_sponsor', 'support']),
  notes: z.string().max(500).optional(),
});

export const updateDealTeamMemberSchema = z.object({
  role: z.enum(['owner', 'technical', 'executive_sponsor', 'support']).optional(),
  notes: z.string().max(500).optional(),
});

// Task schemas
export const createTaskSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(200, 'Subject is too long'),
  content: z.string().max(2000, 'Content is too long').optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  due_date: z.string().optional(),
  deal_id: z.string().optional(),
  contact_id: z.string().optional(),
});

export const updateTaskSchema = createTaskSchema.partial();

// Activity schemas
export const createActivitySchema = z.object({
  type: z.enum(['call', 'email', 'meeting', 'note', 'task']),
  subject: z.string().min(1, 'Subject is required').max(200, 'Subject is too long'),
  content: z.string().max(5000, 'Content is too long').optional(),
  deal_id: z.string().optional(),
  contact_id: z.string().optional(),
  company_id: z.string().optional(),
  due_date: z.string().optional(),
});

export const updateActivitySchema = createActivitySchema.partial();

// Workboard schemas

// Allowed raw fields for workboard columns (prevents arbitrary field injection)
const allowedColumnFields = [
  // Common fields
  'id', 'name', 'created_at', 'updated_at', 'owner_id', 'owner_name',
  // Deal fields
  'value', 'stage', 'close_date', 'probability', 'spin_progress', 'stage_changed_at',
  'contact_id', 'company_id', 'contact_name', 'company_name',
  'spin_situation', 'spin_problem', 'spin_implication', 'spin_need_payoff',
  // Contact fields
  'email', 'phone', 'title', 'status', 'source', 'last_contacted_at',
  // Company fields
  'domain', 'industry', 'employee_count', 'website', 'annual_revenue', 'description',
  'contact_count', 'deal_count', 'total_revenue',
] as const;

// Allowed formula types (computed columns)
const allowedFormulas = [
  'spin_score', 'days_in_stage', 'sla_breach', 'last_activity_days',
] as const;

export const workboardColumnSchema = z.object({
  id: z.string().min(1).max(100),
  field: z.string().min(1).max(100),
  label: z.string().min(1).max(100),
  type: z.enum(['raw', 'formula']),
  formula: z.enum(allowedFormulas).optional(),
  format: z.enum(['text', 'currency', 'date', 'number', 'boolean']).optional(),
  width: z.number().int().positive().max(1000).optional(),
}).refine(
  (data) => {
    // If type is 'formula', formula must be specified
    if (data.type === 'formula') {
      return data.formula !== undefined;
    }
    // If type is 'raw', field must be in allowlist
    return (allowedColumnFields as readonly string[]).includes(data.field);
  },
  {
    message: 'Invalid column configuration: raw columns must use allowed fields, formula columns must specify a valid formula',
  }
);

// Allowed fields for workboard filters (prevents arbitrary field injection)
const allowedFilterFields = [
  // Common fields
  'id', 'name', 'created_at', 'updated_at', 'owner_id',
  // Deal fields
  'value', 'stage', 'close_date', 'probability', 'spin_progress', 'stage_changed_at',
  'contact_id', 'company_id', 'spin_score', 'days_in_stage', 'sla_breach', 'last_activity_days',
  // Contact fields
  'email', 'phone', 'title', 'status', 'source', 'last_contacted_at',
  // Company fields
  'domain', 'industry', 'employee_count', 'website', 'annual_revenue',
] as const;

// Filter value must be one of: string, number, boolean, null, or array of primitives
const filterValueSchema = z.union([
  z.string().max(500), // Limit string length to prevent abuse
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string().max(500), z.number()])).max(100), // For 'in' and 'not_in' operators
]);

export const workboardFilterSchema = z.object({
  field: z.enum(allowedFilterFields),
  operator: z.enum([
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'contains', 'not_contains', 'starts_with', 'ends_with',
    'is_null', 'is_not_null', 'in', 'not_in'
  ]),
  value: filterValueSchema,
});

// Allowed sort columns for workboards (must match allowedColumns used in workboards.ts)
const allowedSortColumns = [
  // Common
  'id', 'name', 'created_at', 'updated_at', 'owner_id',
  // Deals
  'value', 'stage', 'close_date', 'probability', 'spin_progress', 'stage_changed_at', 'contact_id', 'company_id',
  // Contacts
  'email', 'phone', 'title', 'status', 'source', 'last_contacted_at',
  // Companies
  'domain', 'industry', 'employee_count',
  // Formulas (computed)
  'days_in_stage', 'sla_breach', 'last_activity_days',
] as const;

export const createWorkboardSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  description: z.string().max(500, 'Description is too long').optional(),
  entity_type: z.enum(['deals', 'contacts', 'companies']),
  is_shared: z.boolean().optional(),
  columns: z.array(workboardColumnSchema).max(50, 'Too many columns').optional(), // Limit to 50 columns
  filters: z.array(workboardFilterSchema).max(20, 'Too many filters').optional(), // Limit to 20 filters
  sort_column: z.enum(allowedSortColumns).optional(),
  sort_direction: z.enum(['asc', 'desc']).optional(),
});

export const updateWorkboardSchema = createWorkboardSchema.partial();
