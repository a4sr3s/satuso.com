import { z } from 'zod';

// Auth schemas
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
});

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
  company_id: z.string().optional(),
  ownerId: z.string().optional(),
  status: z.enum(['active', 'inactive', 'lead']).optional(),
  source: z.string().max(50, 'Source is too long').optional(),
  // Social profiles
  linkedinUrl: z.string().max(200, 'LinkedIn URL is too long').optional().or(z.literal('')),
  linkedin_url: z.string().max(200, 'LinkedIn URL is too long').optional().or(z.literal('')),
  twitterUrl: z.string().max(200, 'Twitter URL is too long').optional().or(z.literal('')),
  twitter_url: z.string().max(200, 'Twitter URL is too long').optional().or(z.literal('')),
  githubUrl: z.string().max(200, 'GitHub URL is too long').optional().or(z.literal('')),
  github_url: z.string().max(200, 'GitHub URL is too long').optional().or(z.literal('')),
  facebookUrl: z.string().max(200, 'Facebook URL is too long').optional().or(z.literal('')),
  facebook_url: z.string().max(200, 'Facebook URL is too long').optional().or(z.literal('')),
  // Location
  location: z.string().max(200, 'Location is too long').optional().or(z.literal('')),
  locationCity: z.string().max(100, 'City is too long').optional().or(z.literal('')),
  location_city: z.string().max(100, 'City is too long').optional().or(z.literal('')),
  locationRegion: z.string().max(100, 'Region is too long').optional().or(z.literal('')),
  location_region: z.string().max(100, 'Region is too long').optional().or(z.literal('')),
  locationCountry: z.string().max(100, 'Country is too long').optional().or(z.literal('')),
  location_country: z.string().max(100, 'Country is too long').optional().or(z.literal('')),
});

export const updateContactSchema = createContactSchema.partial();

// Company schemas
export const createCompanySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  industry: z.string().max(100, 'Industry is too long').optional(),
  employee_count: z.number().int().positive().optional(),
  website: z.string().max(200, 'Website is too long').optional().or(z.literal('')),
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
export const workboardColumnSchema = z.object({
  id: z.string().min(1),
  field: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['raw', 'formula']),
  formula: z.string().optional(),
  format: z.enum(['text', 'currency', 'date', 'number', 'boolean']).optional(),
  width: z.number().int().positive().optional(),
});

export const workboardFilterSchema = z.object({
  field: z.string().min(1),
  operator: z.enum([
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'contains', 'not_contains', 'starts_with', 'ends_with',
    'is_null', 'is_not_null', 'in', 'not_in'
  ]),
  value: z.any(),
});

export const createWorkboardSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  description: z.string().max(500, 'Description is too long').optional(),
  entity_type: z.enum(['deals', 'contacts', 'companies']),
  is_shared: z.boolean().optional(),
  columns: z.array(workboardColumnSchema).optional(),
  filters: z.array(workboardFilterSchema).optional(),
  sort_column: z.string().optional(),
  sort_direction: z.enum(['asc', 'desc']).optional(),
});

export const updateWorkboardSchema = createWorkboardSchema.partial();
