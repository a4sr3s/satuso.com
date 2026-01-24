import type {
  Contact,
  Company,
  Deal,
  Activity,
  Task,
  ApiResponse,
  PaginatedResponse,
  DashboardMetrics,
  PipelineSummary,
  ForecastData,
  TaskCounts,
  AIInsight,
  AIQueryResult,
  ChatMessage,
  SpinData,
  SpinSuggestions,
  SearchResult,
  RecentSearch,
  CreateContactData,
  CreateCompanyData,
  CreateDealData,
  CreateTaskData,
  CreateActivityData,
  Workboard,
  WorkboardDataRow,
  CreateWorkboardData,
  DealTeamMember,
  AddDealTeamMemberData,
} from '@/types';

const API_BASE = '/api';

interface ApiOptions extends RequestInit {
  params?: Record<string, string>;
}

// Token getter function - will be set by the auth provider
let getAuthToken: (() => Promise<string | null>) | null = null;

export function setTokenGetter(getter: () => Promise<string | null>) {
  getAuthToken = getter;
}

class ApiClient {
  private async request<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const { params, ...fetchOptions } = options;

    let url = `${API_BASE}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Get token from Clerk
    if (getAuthToken) {
      const token = await getAuthToken();
      if (token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
      }
    }

    const response = await fetch(url, {
      ...fetchOptions,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.error || 'An error occurred') as Error & { status?: number };
      error.status = response.status;
      throw error;
    }

    return data;
  }

  get<T>(endpoint: string, params?: Record<string, string>) {
    return this.request<T>(endpoint, { method: 'GET', params });
  }

  post<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient();

// Contacts API
export const contactsApi = {
  list: (params?: Record<string, string>) =>
    api.get<ApiResponse<PaginatedResponse<Contact>>>('/contacts', params),

  get: (id: string) =>
    api.get<ApiResponse<Contact>>(`/contacts/${id}`),

  create: (data: CreateContactData) =>
    api.post<ApiResponse<Contact>>('/contacts', data),

  update: (id: string, data: Partial<CreateContactData>) =>
    api.patch<ApiResponse<Contact>>(`/contacts/${id}`, data),

  delete: (id: string) =>
    api.delete<ApiResponse<null>>(`/contacts/${id}`),
};

// Companies API
export const companiesApi = {
  list: (params?: Record<string, string>) =>
    api.get<ApiResponse<PaginatedResponse<Company>>>('/companies', params),

  get: (id: string) =>
    api.get<ApiResponse<Company>>(`/companies/${id}`),

  create: (data: CreateCompanyData) =>
    api.post<ApiResponse<Company>>('/companies', data),

  update: (id: string, data: Partial<CreateCompanyData>) =>
    api.patch<ApiResponse<Company>>(`/companies/${id}`, data),

  delete: (id: string) =>
    api.delete<ApiResponse<null>>(`/companies/${id}`),
};

// Deals API
export const dealsApi = {
  list: (params?: Record<string, string>) =>
    api.get<ApiResponse<PaginatedResponse<Deal>>>('/deals', params),

  pipeline: (params?: Record<string, string>) =>
    api.get<ApiResponse<Record<string, Deal[]>>>('/deals/pipeline', params),

  get: (id: string) =>
    api.get<ApiResponse<Deal>>(`/deals/${id}`),

  create: (data: CreateDealData) =>
    api.post<ApiResponse<Deal>>('/deals', data),

  update: (id: string, data: Partial<CreateDealData>) =>
    api.patch<ApiResponse<Deal>>(`/deals/${id}`, data),

  move: (id: string, stage: string) =>
    api.post<ApiResponse<Deal>>(`/deals/${id}/move`, { stage }),

  delete: (id: string) =>
    api.delete<ApiResponse<null>>(`/deals/${id}`),

  // Deal Team
  getTeam: (dealId: string) =>
    api.get<ApiResponse<DealTeamMember[]>>(`/deals/${dealId}/team`),

  addTeamMember: (dealId: string, data: AddDealTeamMemberData) =>
    api.post<ApiResponse<DealTeamMember>>(`/deals/${dealId}/team`, data),

  updateTeamMember: (dealId: string, memberId: string, data: Partial<AddDealTeamMemberData>) =>
    api.patch<ApiResponse<DealTeamMember>>(`/deals/${dealId}/team/${memberId}`, data),

  removeTeamMember: (dealId: string, memberId: string) =>
    api.delete<ApiResponse<null>>(`/deals/${dealId}/team/${memberId}`),

  getAvailableUsers: (dealId: string, params?: Record<string, string>) =>
    api.get<ApiResponse<Array<{ id: string; name: string; email: string; job_function: string | null }>>>(`/deals/${dealId}/team/available`, params),
};

// Activities API
export const activitiesApi = {
  list: (params?: Record<string, string>) =>
    api.get<ApiResponse<PaginatedResponse<Activity>>>('/activities', params),

  feed: (limit?: number) =>
    api.get<ApiResponse<Activity[]>>('/activities/feed', { limit: String(limit || 20) }),

  get: (id: string) =>
    api.get<ApiResponse<Activity>>(`/activities/${id}`),

  create: (data: CreateActivityData) =>
    api.post<ApiResponse<Activity>>('/activities', data),

  update: (id: string, data: Partial<CreateActivityData>) =>
    api.patch<ApiResponse<Activity>>(`/activities/${id}`, data),

  complete: (id: string) =>
    api.post<ApiResponse<Activity>>(`/activities/${id}/complete`),

  delete: (id: string) =>
    api.delete<ApiResponse<null>>(`/activities/${id}`),
};

// Tasks API
export const tasksApi = {
  list: (params?: Record<string, string>) =>
    api.get<ApiResponse<PaginatedResponse<Task>>>('/tasks', params),

  counts: () =>
    api.get<ApiResponse<TaskCounts>>('/tasks/counts'),

  get: (id: string) =>
    api.get<ApiResponse<Task>>(`/tasks/${id}`),

  create: (data: CreateTaskData) =>
    api.post<ApiResponse<Task>>('/tasks', data),

  update: (id: string, data: Partial<CreateTaskData>) =>
    api.patch<ApiResponse<Task>>(`/tasks/${id}`, data),

  toggle: (id: string) =>
    api.post<ApiResponse<Task>>(`/tasks/${id}/toggle`),

  delete: (id: string) =>
    api.delete<ApiResponse<null>>(`/tasks/${id}`),
};

// Dashboard API
export const dashboardApi = {
  metrics: () =>
    api.get<ApiResponse<DashboardMetrics>>('/dashboard/metrics'),

  activity: (limit?: number) =>
    api.get<ApiResponse<Activity[]>>('/dashboard/activity', { limit: String(limit || 10) }),

  pipeline: () =>
    api.get<ApiResponse<PipelineSummary[]>>('/dashboard/pipeline'),

  atRisk: () =>
    api.get<ApiResponse<Deal[]>>('/dashboard/at-risk'),

  forecast: () =>
    api.get<ApiResponse<ForecastData>>('/dashboard/forecast'),
};

// Helper to get auth headers for custom fetch calls
async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (getAuthToken) {
    const token = await getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return headers;
}

// AI API
export const aiApi = {
  extractSpin: (text: string, dealId?: string) =>
    api.post<ApiResponse<SpinData>>('/ai/extract-spin', { text, dealId }),

  spinSuggestions: (dealId?: string, industry?: string, companySize?: string, currentStage?: string) =>
    api.post<ApiResponse<SpinSuggestions>>('/ai/spin-suggestions', { dealId, industry, companySize, currentStage }),

  chat: (messages: ChatMessage[]) =>
    api.post<ApiResponse<AIQueryResult>>('/ai/chat', { messages }),

  stt: async (audioBlob: Blob): Promise<{ text: string }> => {
    const authHeaders = await getAuthHeaders();
    const formData = new FormData();
    formData.append('audio', audioBlob);

    const response = await fetch(`${API_BASE}/ai/stt`, {
      method: 'POST',
      headers: authHeaders,
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'STT request failed');
    }
    return data.data;
  },

  tts: async (text: string, voice?: string): Promise<ArrayBuffer> => {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/ai/tts`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, voice }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'TTS request failed');
    }
    return response.arrayBuffer();
  },

  insights: () =>
    api.get<ApiResponse<AIInsight[]>>('/ai/insights'),
};

// Search API
export const searchApi = {
  search: (q: string, limit?: number) =>
    api.get<ApiResponse<SearchResult[]>>('/search', { q, limit: String(limit || 10) }),

  recent: () =>
    api.get<ApiResponse<RecentSearch[]>>('/search/recent'),

  trackRecent: (item: { type: string; id: string; title: string; url: string }) =>
    api.post<ApiResponse<null>>('/search/recent', item),
};

// Organizations API
export const organizationsApi = {
  get: () =>
    api.get<ApiResponse<{
      id: string;
      name: string;
      plan: 'standard' | 'enterprise';
      user_limit: number | null;
      user_count: number;
      owner_id: string;
      created_at: string;
    }>>('/organizations'),

  update: (data: { name?: string }) =>
    api.patch<ApiResponse<null>>('/organizations', data),

  getMembers: () =>
    api.get<ApiResponse<Array<{
      id: string;
      email: string;
      name: string;
      role: string;
      avatar_url: string | null;
      job_function: string | null;
      created_at: string;
    }>>>('/organizations/members'),

  updateMemberRole: (id: string, job_function: string) =>
    api.patch<ApiResponse<null>>(`/organizations/members/${id}/role`, { job_function }),

  invite: (email: string, role: 'admin' | 'manager' | 'rep') =>
    api.post<ApiResponse<{ inviteId: string; inviteToken: string; expiresAt: string }>>('/organizations/invite', { email, role }),

  getInvites: () =>
    api.get<ApiResponse<Array<{
      id: string;
      email: string;
      role: string;
      expires_at: string;
      created_at: string;
      invited_by_name: string;
    }>>>('/organizations/invites'),

  cancelInvite: (id: string) =>
    api.delete<ApiResponse<null>>(`/organizations/invites/${id}`),

  removeMember: (id: string) =>
    api.delete<ApiResponse<null>>(`/organizations/members/${id}`),
};

// Workboards API
export const workboardsApi = {
  list: (params?: Record<string, string>) =>
    api.get<ApiResponse<{ items: Workboard[] }>>('/workboards', params),

  get: (id: string) =>
    api.get<ApiResponse<Workboard>>(`/workboards/${id}`),

  getData: (id: string, params?: Record<string, string>) =>
    api.get<ApiResponse<PaginatedResponse<WorkboardDataRow>>>(`/workboards/${id}/data`, params),

  create: (data: CreateWorkboardData) =>
    api.post<ApiResponse<Workboard>>('/workboards', data),

  update: (id: string, data: Partial<CreateWorkboardData>) =>
    api.patch<ApiResponse<Workboard>>(`/workboards/${id}`, data),

  delete: (id: string) =>
    api.delete<ApiResponse<null>>(`/workboards/${id}`),

  duplicate: (id: string) =>
    api.post<ApiResponse<Workboard>>(`/workboards/${id}/duplicate`),
};
