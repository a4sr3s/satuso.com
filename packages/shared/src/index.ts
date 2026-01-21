// User types
export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: 'admin' | 'manager' | 'rep';
  createdAt: string;
  updatedAt: string;
}

// Contact types
export interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  title?: string;
  companyId?: string;
  company?: Company;
  ownerId: string;
  owner?: User;
  status: 'active' | 'inactive' | 'lead';
  source?: string;
  linkedinUrl?: string;
  lastContactedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Company types
export interface Company {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  employeeCount?: number;
  annualRevenue?: number;
  logoUrl?: string;
  website?: string;
  description?: string;
  ownerId: string;
  owner?: User;
  createdAt: string;
  updatedAt: string;
}

// SPIN types
export interface SpinInsights {
  situation: string[];
  problem: string[];
  implication: string[];
  needPayoff: string[];
}

export type SpinCategory = 'situation' | 'problem' | 'implication' | 'needPayoff';

export interface SpinProgress {
  situation: 'empty' | 'partial' | 'complete';
  problem: 'empty' | 'partial' | 'complete';
  implication: 'empty' | 'partial' | 'complete';
  needPayoff: 'empty' | 'partial' | 'complete';
}

// Deal types
export type DealStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';

export interface Deal {
  id: string;
  name: string;
  value: number;
  stage: DealStage;
  probability?: number;
  contactId?: string;
  contact?: Contact;
  companyId?: string;
  company?: Company;
  ownerId: string;
  owner?: User;
  closeDate?: string;
  spinSituation?: string;
  spinProblem?: string;
  spinImplication?: string;
  spinNeedPayoff?: string;
  spinProgress: number; // 0-4 indicating how many SPIN categories are filled
  daysInStage: number;
  aiScore?: number;
  aiScoreReason?: string;
  createdAt: string;
  updatedAt: string;
}

// Activity types
export type ActivityType = 'call' | 'email' | 'meeting' | 'note' | 'task';

export interface Activity {
  id: string;
  type: ActivityType;
  subject?: string;
  content: string;
  dealId?: string;
  deal?: Deal;
  contactId?: string;
  contact?: Contact;
  companyId?: string;
  company?: Company;
  ownerId: string;
  owner?: User;
  spinTags?: SpinTag[];
  dueDate?: string;
  completed: boolean;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SpinTag {
  category: SpinCategory;
  text: string;
  confidence: number;
}

// Task types (subset of Activity)
export interface Task {
  id: string;
  subject: string;
  content?: string;
  dealId?: string;
  contactId?: string;
  companyId?: string;
  ownerId: string;
  owner?: User;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Dashboard metrics
export interface DashboardMetrics {
  totalRevenue: MetricValue;
  activeDeals: MetricValue;
  conversionRate: MetricValue;
  tasksDueToday: MetricValue;
}

export interface MetricValue {
  value: number;
  previousValue: number;
  change: number;
  changeDirection: 'up' | 'down' | 'neutral';
  sparklineData: number[];
}

// AI types
export interface AIInsight {
  id: string;
  type: 'risk' | 'opportunity' | 'suggestion' | 'forecast';
  title: string;
  description: string;
  actionLabel?: string;
  actionUrl?: string;
  dealId?: string;
  contactId?: string;
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
}

export interface AISpinSuggestion {
  category: SpinCategory;
  question: string;
  reason: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

// Search types
export interface SearchResult {
  type: 'contact' | 'company' | 'deal' | 'activity';
  id: string;
  title: string;
  subtitle?: string;
  url: string;
}

// Notification types
export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  read: boolean;
  actionUrl?: string;
  createdAt: string;
}
