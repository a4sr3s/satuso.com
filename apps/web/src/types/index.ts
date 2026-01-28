// ============================================
// Core Entity Types
// ============================================

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  company_id: string | null;
  company_name: string | null;
  status: 'active' | 'inactive' | 'lead';
  owner_id: string;
  owner_name: string | null;
  last_contacted_at: string | null;
  // Social profiles
  linkedin_url?: string | null;
  twitter_url?: string | null;
  github_url?: string | null;
  facebook_url?: string | null;
  // Location
  location?: string | null;
  location_city?: string | null;
  location_region?: string | null;
  location_country?: string | null;
  created_at: string;
  updated_at: string;
  // Populated in detail views
  activities?: Activity[];
  deals?: Deal[];
}

export interface Company {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  employee_count: number | null;
  website: string | null;
  logo_url: string | null;
  description?: string | null;
  annual_revenue?: number | null;
  linkedin_url?: string | null;
  owner_id: string;
  contact_count: number;
  deal_count: number;
  total_revenue: number;
  created_at: string;
  updated_at: string;
  // Populated in detail views
  contacts?: Contact[];
  deals?: Deal[];
}

export type DealStage = 'lead' | 'qualified' | 'discovery' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';

export type DealTeamRole = 'owner' | 'technical' | 'executive_sponsor' | 'support';
export type JobFunction = 'ae' | 'se' | 'sa' | 'csm' | 'manager' | 'executive';

export interface DealTeamMember {
  id: string;
  deal_id: string;
  user_id: string;
  role: DealTeamRole;
  notes: string | null;
  assigned_at: string;
  assigned_by: string | null;
  user_name: string;
  user_email: string;
  job_function: JobFunction | null;
  assigned_by_name: string | null;
}

export interface AddDealTeamMemberData {
  user_id: string;
  role: DealTeamRole;
  notes?: string;
}

export interface Deal {
  id: string;
  name: string;
  value: number | null;
  stage: DealStage;
  close_date: string | null;
  probability: number | null;
  company_id: string | null;
  company_name: string | null;
  contact_id: string | null;
  contact_name: string | null;
  owner_id: string;
  owner_name: string | null;
  spin_situation: string | null;
  spin_problem: string | null;
  spin_implication: string | null;
  spin_need_payoff: string | null;
  ai_score?: number | null;
  ai_score_reason?: string | null;
  days_in_stage: number;
  created_at: string;
  updated_at: string;
  // Populated in detail views
  activities?: Activity[];
  team?: DealTeamMember[];
  contacts?: Array<{
    id: string;
    name: string;
    email: string | null;
    title: string | null;
    status: string | null;
  }>;
}

export type ActivityType = 'call' | 'email' | 'meeting' | 'note' | 'task';

export interface Activity {
  id: string;
  type: ActivityType;
  subject: string;
  content: string | null;
  deal_id: string | null;
  deal_name: string | null;
  contact_id: string | null;
  contact_name: string | null;
  company_id: string | null;
  company_name: string | null;
  owner_id: string;
  owner_name: string | null;
  completed: boolean;
  completed_at: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  subject: string;
  content: string | null;
  priority: TaskPriority;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  deal_id: string | null;
  deal_name: string | null;
  contact_id: string | null;
  contact_name: string | null;
  owner_id: string;
  owner_name: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  hasMore: boolean;
}

// ============================================
// Dashboard Types
// ============================================

export interface MetricData {
  value: number;
  change?: number;
  changeDirection?: 'up' | 'down';
  sparklineData?: number[];
}

export interface DashboardMetrics {
  totalRevenue: MetricData;
  activeDeals: MetricData;
  conversionRate: MetricData;
  tasksDueToday: MetricData;
}

export interface PipelineSummary {
  stage: DealStage;
  count: number;
  totalValue: number;
}

export interface ForecastSummary {
  dealCount: number;
  rawValue: number;
  weightedValue: number;
}

export interface ForecastData {
  summary: { nextMonth: ForecastSummary; thisQuarter: ForecastSummary };
  chart: {
    months: string[];
    owners: { id: string; name: string }[];
    data: Array<Record<string, number | string>>;
  };
}

// ============================================
// AI Types
// ============================================

export interface SpinData {
  situation: string | null;
  problem: string | null;
  implication: string | null;
  needPayoff: string | null;
}

export interface SpinQuestion {
  question: string;
  reason: string;
}

export interface SpinSuggestions {
  situation?: SpinQuestion[];
  problem?: SpinQuestion[];
  implication?: SpinQuestion[];
  needPayoff?: SpinQuestion[];
}

export interface AIInsight {
  type: 'risk' | 'opportunity' | 'tip';
  title: string;
  description: string;
  dealId?: string;
  dealName?: string;
}

export interface AIQueryResult {
  response: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ============================================
// Task Counts
// ============================================

export interface TaskCounts {
  pending: number;
  today: number;
  overdue: number;
  this_week: number;
  completed: number;
}

// ============================================
// Search Types
// ============================================

export interface SearchResult {
  type: 'contact' | 'company' | 'deal';
  id: string;
  title: string;
  subtitle?: string;
  url: string;
}

export interface RecentSearch {
  type: string;
  id: string;
  title: string;
  url: string;
  timestamp: string;
}

// ============================================
// Billing Types
// ============================================

export interface SubscriptionInfo {
  status: 'active' | 'inactive' | 'past_due' | 'canceled' | 'trialing';
  plan: string;
  stripeCustomerId: string | null;
  onboardingCompleted: boolean;
  isInTrial: boolean;
  trialEndsAt: string | null;
  trialDaysRemaining: number;
  isActive: boolean;
}

// ============================================
// Form Data Types (for create/update)
// ============================================

export interface CreateContactData {
  name: string;
  email?: string;
  phone?: string;
  title?: string;
  company_id?: string;
  status?: Contact['status'];
  // Social profiles
  linkedin_url?: string;
  twitter_url?: string;
  github_url?: string;
  facebook_url?: string;
  // Location
  location?: string;
  location_city?: string;
  location_region?: string;
  location_country?: string;
}

export interface CreateCompanyData {
  name: string;
  domain?: string;
  industry?: string;
  employee_count?: number;
  website?: string;
}

export interface CreateDealData {
  name: string;
  value?: number;
  stage?: DealStage;
  close_date?: string;
  company_id?: string;
  contact_id?: string;
}

export interface CreateTaskData {
  subject: string;
  content?: string;
  priority?: TaskPriority;
  due_date?: string;
  deal_id?: string;
  contact_id?: string;
}

export interface CreateActivityData {
  type: ActivityType;
  subject: string;
  content?: string;
  deal_id?: string;
  contact_id?: string;
  company_id?: string;
  due_date?: string;
}

// ============================================
// Workboard Types
// ============================================

export type WorkboardEntityType = 'deals' | 'contacts' | 'companies';
export type ColumnType = 'raw' | 'formula';
export type FormulaFieldType = 'days_in_stage' | 'sla_breach' | 'spin_score' | 'last_activity_days';
export type ColumnFormat = 'text' | 'currency' | 'date' | 'number' | 'boolean';
export type FilterOperator =
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'contains' | 'not_contains' | 'starts_with' | 'ends_with'
  | 'is_null' | 'is_not_null' | 'in' | 'not_in';
export type SortDirection = 'asc' | 'desc';

export interface WorkboardColumn {
  id: string;
  field: string;
  label: string;
  type: ColumnType;
  formula?: FormulaFieldType;
  format?: ColumnFormat;
  width?: number;
}

export interface WorkboardFilter {
  field: string;
  operator: FilterOperator;
  value: any;
}

export interface Workboard {
  id: string;
  name: string;
  description: string | null;
  entity_type: WorkboardEntityType;
  owner_id: string | null;
  owner_name: string | null;
  is_default: boolean;
  is_shared: boolean;
  columns: WorkboardColumn[];
  filters: WorkboardFilter[];
  sort_column: string | null;
  sort_direction: SortDirection;
  created_at: string;
  updated_at: string;
}

export interface WorkboardDataRowProvenance {
  source: WorkboardEntityType;
  fetchedAt: string;
}

export interface WorkboardDataRow {
  [key: string]: any;
  _provenance: WorkboardDataRowProvenance;
}

export interface SpinScore {
  score: number;
  breakdown: {
    situation: number;
    problem: number;
    implication: number;
    needPayoff: number;
  };
  completeness: number;
}

export interface CreateWorkboardData {
  name: string;
  description?: string;
  entity_type: WorkboardEntityType;
  is_shared?: boolean;
  columns?: WorkboardColumn[];
  filters?: WorkboardFilter[];
  sort_column?: string;
  sort_direction?: SortDirection;
}
