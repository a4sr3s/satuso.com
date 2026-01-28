import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env, Variables } from '../_types';
import { clerkAuthMiddleware } from '../_middleware/clerk-auth';

const integrations = new Hono<{ Bindings: Env; Variables: Variables }>();

// Apply auth middleware to all routes
integrations.use('*', clerkAuthMiddleware);

// Schemas
const upsertIntegrationSchema = z.object({
  provider: z.enum(['peopledatalabs']),
  api_key: z.string().min(1),
  enabled: z.boolean().default(true),
});

const updateIntegrationSchema = z.object({
  api_key: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
});

// Supported providers
const SUPPORTED_PROVIDERS = [
  {
    id: 'peopledatalabs',
    name: 'People Data Labs',
    description: 'Enrich contacts and companies with B2B data',
    website: 'https://www.peopledatalabs.com',
    features: ['Contact enrichment', 'Company enrichment'],
  },
];

// List supported providers
integrations.get('/providers', async (c) => {
  return c.json({ success: true, data: SUPPORTED_PROVIDERS });
});

// List configured integrations for the organization
integrations.get('/', async (c) => {
  const user = c.get('user');

  if (!user.organization_id) {
    return c.json({ success: false, error: 'No organization found' }, 404);
  }

  // Only admins can view integrations
  if (user.role !== 'admin') {
    return c.json({ success: false, error: 'Only admins can manage integrations' }, 403);
  }

  const results = await c.env.DB.prepare(
    `SELECT id, provider, enabled, created_at, updated_at,
       CASE WHEN api_key IS NOT NULL THEN 1 ELSE 0 END as has_api_key
     FROM integrations
     WHERE organization_id = ?`
  ).bind(user.organization_id).all();

  return c.json({ success: true, data: results.results });
});

// Get a specific integration
integrations.get('/:provider', async (c) => {
  const user = c.get('user');
  const provider = c.req.param('provider');

  if (!user.organization_id) {
    return c.json({ success: false, error: 'No organization found' }, 404);
  }

  if (user.role !== 'admin') {
    return c.json({ success: false, error: 'Only admins can manage integrations' }, 403);
  }

  const integration = await c.env.DB.prepare(
    `SELECT id, provider, enabled, settings, created_at, updated_at,
       CASE WHEN api_key IS NOT NULL THEN 1 ELSE 0 END as has_api_key
     FROM integrations
     WHERE organization_id = ? AND provider = ?`
  ).bind(user.organization_id, provider).first();

  if (!integration) {
    return c.json({ success: false, error: 'Integration not found' }, 404);
  }

  return c.json({ success: true, data: integration });
});

// Create or update an integration (upsert)
integrations.post('/', zValidator('json', upsertIntegrationSchema), async (c) => {
  const user = c.get('user');
  const { provider, api_key, enabled } = c.req.valid('json');

  if (!user.organization_id) {
    return c.json({ success: false, error: 'No organization found' }, 404);
  }

  if (user.role !== 'admin') {
    return c.json({ success: false, error: 'Only admins can manage integrations' }, 403);
  }

  const now = new Date().toISOString();

  // Check if integration already exists
  const existing = await c.env.DB.prepare(
    'SELECT id FROM integrations WHERE organization_id = ? AND provider = ?'
  ).bind(user.organization_id, provider).first();

  if (existing) {
    // Update existing
    await c.env.DB.prepare(
      `UPDATE integrations
       SET api_key = ?, enabled = ?, updated_at = ?
       WHERE organization_id = ? AND provider = ?`
    ).bind(api_key, enabled ? 1 : 0, now, user.organization_id, provider).run();

    console.log(`[AUDIT] Integration updated: provider=${provider} org=${user.organization_id} actor=${user.id}`);

    return c.json({ success: true, message: 'Integration updated' });
  } else {
    // Create new
    const id = nanoid();
    await c.env.DB.prepare(
      `INSERT INTO integrations (id, organization_id, provider, api_key, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, user.organization_id, provider, api_key, enabled ? 1 : 0, now, now).run();

    console.log(`[AUDIT] Integration created: provider=${provider} org=${user.organization_id} actor=${user.id}`);

    return c.json({ success: true, data: { id } });
  }
});

// Update an integration
integrations.patch('/:provider', zValidator('json', updateIntegrationSchema), async (c) => {
  const user = c.get('user');
  const provider = c.req.param('provider');
  const updates = c.req.valid('json');

  if (!user.organization_id) {
    return c.json({ success: false, error: 'No organization found' }, 404);
  }

  if (user.role !== 'admin') {
    return c.json({ success: false, error: 'Only admins can manage integrations' }, 403);
  }

  const existing = await c.env.DB.prepare(
    'SELECT id FROM integrations WHERE organization_id = ? AND provider = ?'
  ).bind(user.organization_id, provider).first();

  if (!existing) {
    return c.json({ success: false, error: 'Integration not found' }, 404);
  }

  const now = new Date().toISOString();
  const setClauses: string[] = ['updated_at = ?'];
  const values: (string | number)[] = [now];

  if (updates.api_key !== undefined) {
    setClauses.push('api_key = ?');
    values.push(updates.api_key);
  }

  if (updates.enabled !== undefined) {
    setClauses.push('enabled = ?');
    values.push(updates.enabled ? 1 : 0);
  }

  values.push(user.organization_id, provider);

  await c.env.DB.prepare(
    `UPDATE integrations SET ${setClauses.join(', ')} WHERE organization_id = ? AND provider = ?`
  ).bind(...values).run();

  console.log(`[AUDIT] Integration updated: provider=${provider} org=${user.organization_id} actor=${user.id}`);

  return c.json({ success: true });
});

// Delete an integration
integrations.delete('/:provider', async (c) => {
  const user = c.get('user');
  const provider = c.req.param('provider');

  if (!user.organization_id) {
    return c.json({ success: false, error: 'No organization found' }, 404);
  }

  if (user.role !== 'admin') {
    return c.json({ success: false, error: 'Only admins can manage integrations' }, 403);
  }

  await c.env.DB.prepare(
    'DELETE FROM integrations WHERE organization_id = ? AND provider = ?'
  ).bind(user.organization_id, provider).run();

  console.log(`[AUDIT] Integration deleted: provider=${provider} org=${user.organization_id} actor=${user.id}`);

  return c.json({ success: true });
});

// Test an integration connection
integrations.post('/:provider/test', async (c) => {
  const user = c.get('user');
  const provider = c.req.param('provider');

  if (!user.organization_id) {
    return c.json({ success: false, error: 'No organization found' }, 404);
  }

  if (user.role !== 'admin') {
    return c.json({ success: false, error: 'Only admins can manage integrations' }, 403);
  }

  const integration = await c.env.DB.prepare(
    'SELECT api_key FROM integrations WHERE organization_id = ? AND provider = ?'
  ).bind(user.organization_id, provider).first<{ api_key: string }>();

  if (!integration || !integration.api_key) {
    return c.json({ success: false, error: 'Integration not configured' }, 404);
  }

  // Test the API key based on provider
  if (provider === 'peopledatalabs') {
    try {
      // Use PDL's person enrichment API with a test query
      const response = await fetch('https://api.peopledatalabs.com/v5/person/enrich?email=test@test.com', {
        method: 'GET',
        headers: {
          'X-Api-Key': integration.api_key,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json() as { status?: number; error?: { message?: string } };

      // PDL returns 404 for no match (valid API key) or 401/403 for invalid key
      if (response.status === 401 || response.status === 403) {
        return c.json({ success: false, error: 'Invalid API key' }, 400);
      }

      // 200, 404 (no match), or 402 (no credits but valid key) are all valid
      return c.json({
        success: true,
        message: 'API key is valid',
        credits_remaining: response.status === 402 ? 0 : undefined
      });
    } catch (error) {
      console.error('PDL test error:', error);
      return c.json({ success: false, error: 'Failed to connect to People Data Labs' }, 500);
    }
  }

  return c.json({ success: false, error: 'Unknown provider' }, 400);
});

// ========================================
// DATA ENRICHMENT ENDPOINTS
// ========================================

// Schemas for enrichment
// Note: Don't use .url() validation for linkedin_url - it may come in various formats
const enrichContactSchema = z.object({
  email: z.string().email().optional(),
  linkedin_url: z.string().optional(),
  name: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  company: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
}).refine(data => data.email || data.linkedin_url || (data.name && data.company), {
  message: 'Either email, linkedin_url, or name+company is required',
});

const enrichCompanySchema = z.object({
  website: z.string().optional(),
  name: z.string().optional(),
  linkedin_url: z.string().optional(),
  ticker: z.string().optional(),
}).refine(data => data.website || data.name || data.linkedin_url, {
  message: 'Either website, name, or linkedin_url is required',
});

// Helper to normalize LinkedIn URL to full format for PDL
function normalizeLinkedInUrl(input: string | undefined): string | undefined {
  if (!input) return undefined;

  const trimmed = input.trim();
  if (!trimmed) return undefined;

  // Already a full URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Handle /in/username format
  if (trimmed.startsWith('/in/')) {
    return `https://linkedin.com${trimmed}`;
  }

  // Handle in/username format
  if (trimmed.startsWith('in/')) {
    return `https://linkedin.com/${trimmed}`;
  }

  // Handle linkedin.com/in/username (no protocol)
  if (trimmed.startsWith('linkedin.com')) {
    return `https://${trimmed}`;
  }

  // Handle just username - assume it's a LinkedIn username
  if (/^[a-zA-Z0-9-]+$/.test(trimmed)) {
    return `https://linkedin.com/in/${trimmed}`;
  }

  // Return as-is if we can't normalize
  return trimmed;
}

// Helper to get PDL API key for org
async function getPdlApiKey(db: D1Database, organizationId: string): Promise<string | null> {
  const integration = await db.prepare(
    'SELECT api_key FROM integrations WHERE organization_id = ? AND provider = ? AND enabled = 1'
  ).bind(organizationId, 'peopledatalabs').first<{ api_key: string }>();

  return integration?.api_key || null;
}

// Helper to log enrichment
async function logEnrichment(
  db: D1Database,
  organizationId: string,
  userId: string,
  provider: string,
  entityType: string,
  entityId: string,
  status: string,
  creditsUsed: number = 0
) {
  const id = nanoid();
  const now = new Date().toISOString();

  await db.prepare(
    `INSERT INTO enrichment_history (id, organization_id, user_id, provider, entity_type, entity_id, status, credits_used, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, organizationId, userId, provider, entityType, entityId, status, creditsUsed, now).run();
}

// PDL Person response type (expanded to capture more fields)
interface PDLPersonResponse {
  status: number;
  likelihood?: number; // 1-10 confidence score
  matched?: string[]; // which input fields matched
  data?: {
    // Identity
    id?: string;
    full_name?: string;
    first_name?: string;
    last_name?: string;
    middle_name?: string;
    name_aliases?: string[];

    // Contact
    emails?: Array<{ address?: string; type?: string }>;
    work_email?: string;
    personal_emails?: string[];
    recommended_personal_email?: string;
    phone_numbers?: string[];
    mobile_phone?: string;

    // Social profiles
    linkedin_url?: string;
    linkedin_id?: string;
    linkedin_username?: string;
    twitter_url?: string;
    twitter_username?: string;
    github_url?: string;
    github_username?: string;
    facebook_url?: string;
    facebook_username?: string;

    // Current job
    job_title?: string;
    job_title_role?: string;
    job_title_levels?: string[];
    job_company_name?: string;
    job_company_website?: string;
    job_company_industry?: string;
    job_company_size?: string;
    job_company_employee_count?: number;
    job_company_founded?: number;
    job_company_linkedin_url?: string;
    job_company_location_name?: string;
    job_start_date?: string;
    job_summary?: string;
    inferred_salary?: string;

    // Location
    location_name?: string;
    location_locality?: string;
    location_region?: string;
    location_country?: string;
    location_continent?: string;
    location_postal_code?: string;
    location_street_address?: string;

    // Demographics
    birth_year?: number;
    birth_date?: string;
    sex?: string;

    // Experience history
    experience?: Array<{
      title?: { name?: string; role?: string; levels?: string[] };
      company?: {
        name?: string;
        website?: string;
        size?: string;
        industry?: string;
        linkedin_url?: string;
      };
      start_date?: string;
      end_date?: string;
      is_primary?: boolean;
      summary?: string;
      location_names?: string[];
    }>;

    // Education
    education?: Array<{
      school?: { name?: string; type?: string; linkedin_url?: string };
      degrees?: string[];
      majors?: string[];
      minors?: string[];
      start_date?: string;
      end_date?: string;
      gpa?: number;
    }>;

    // Skills & interests
    skills?: string[];
    interests?: string[];
    languages?: Array<{ name?: string; proficiency?: string }>;

    // Industry
    industry?: string;

    // Certifications
    certifications?: Array<{
      name?: string;
      organization?: string;
      start_date?: string;
      end_date?: string;
    }>;
  };
  error?: { message?: string };
}

// PDL Company response type (expanded to capture more fields)
interface PDLCompanyResponse {
  status: number;
  likelihood?: number; // 1-10 confidence score
  matched?: string[]; // which input fields matched
  // Company fields are at top level (not nested in data)
  id?: string;
  name?: string;
  display_name?: string;
  website?: string;
  alternative_domains?: string[];
  alternative_names?: string[];
  size?: string;
  employee_count?: number;
  employee_count_by_country?: Record<string, number>;
  industry?: string;
  headline?: string;
  summary?: string;
  tags?: string[];

  // Social
  linkedin_url?: string;
  linkedin_id?: string;
  linkedin_slug?: string;
  twitter_url?: string;
  facebook_url?: string;
  profiles?: string[];

  // Location
  location?: {
    name?: string;
    locality?: string;
    region?: string;
    metro?: string;
    country?: string;
    continent?: string;
    street_address?: string;
    address_line_2?: string;
    postal_code?: string;
    geo?: string;
  };

  // Company info
  founded?: number;
  type?: string; // public, private, subsidiary, etc.
  ticker?: string;
  mic_exchange?: string;

  // Funding
  total_funding_raised?: number;
  latest_funding_stage?: string;
  last_funding_date?: string;
  number_funding_rounds?: number;
  funding_stages?: string[];

  // Revenue
  inferred_revenue?: string;

  // Industry codes
  naics?: Array<{ code?: string; sector?: string; sub_sector?: string; industry_group?: string }>;
  sic?: Array<{ code?: string; major_group?: string; industry_group?: string }>;

  // Growth metrics (premium)
  average_employee_tenure?: number;
  employee_growth_rate?: Record<string, number>;
  employee_churn_rate?: Record<string, number>;

  // Affiliates
  affiliated_profiles?: string[];

  error?: { message?: string };
}

// Enrich a contact using PDL
integrations.post('/enrich/contact', zValidator('json', enrichContactSchema), async (c) => {
  const user = c.get('user');
  const params = c.req.valid('json');

  if (!user.organization_id) {
    return c.json({ success: false, error: 'No organization found' }, 404);
  }

  const apiKey = await getPdlApiKey(c.env.DB, user.organization_id);
  if (!apiKey) {
    return c.json({
      success: false,
      error: 'People Data Labs integration not configured. Ask an admin to set it up in Settings > Integrations.'
    }, 400);
  }

  try {
    // Build PDL query parameters with expanded inputs for better matching
    const queryParams = new URLSearchParams();

    // Quality threshold - use 5 for good balance of accuracy vs matches
    queryParams.set('min_likelihood', '5');
    // Include which fields matched for transparency
    queryParams.set('include_if_matched', 'true');

    // Identity params
    if (params.email) queryParams.set('email', params.email);
    const normalizedLinkedIn = normalizeLinkedInUrl(params.linkedin_url);
    if (normalizedLinkedIn) queryParams.set('profile', normalizedLinkedIn);

    // Name handling - send both full name and split names for better matching
    if (params.name) {
      queryParams.set('name', params.name);
      // Also split into first/last if not provided separately
      if (!params.first_name && !params.last_name) {
        const nameParts = params.name.trim().split(/\s+/);
        if (nameParts.length >= 2) {
          queryParams.set('first_name', nameParts[0]);
          queryParams.set('last_name', nameParts[nameParts.length - 1]);
        }
      }
    }
    if (params.first_name) queryParams.set('first_name', params.first_name);
    if (params.last_name) queryParams.set('last_name', params.last_name);

    // Context params for better matching
    if (params.company) queryParams.set('company', params.company);
    if (params.phone) {
      // PDL requires phone in +[country code] format
      let phone = params.phone.trim();
      if (!phone.startsWith('+')) {
        // Assume US if no country code
        phone = phone.replace(/\D/g, '');
        if (phone.length === 10) {
          phone = `+1${phone}`;
        } else if (phone.length === 11 && phone.startsWith('1')) {
          phone = `+${phone}`;
        }
      }
      queryParams.set('phone', phone);
    }
    if (params.location) queryParams.set('location', params.location);

    console.log(`[PDL] Person enrichment request: ${queryParams.toString()}`);

    const response = await fetch(`https://api.peopledatalabs.com/v5/person/enrich?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json() as PDLPersonResponse;

    console.log(`[PDL] Person enrichment response: status=${response.status}, likelihood=${result.likelihood}, hasData=${!!result.data}`);

    if (response.status === 401 || response.status === 403) {
      return c.json({ success: false, error: 'Invalid API key' }, 401);
    }

    if (response.status === 402) {
      return c.json({ success: false, error: 'No API credits remaining' }, 402);
    }

    if (response.status === 404 || !result.data) {
      await logEnrichment(c.env.DB, user.organization_id, user.id, 'peopledatalabs', 'contact', params.email || params.linkedin_url || '', 'no_match');
      return c.json({
        success: false,
        error: 'No matching person found. Try adding more details like company name or LinkedIn URL to improve matching.'
      }, 404);
    }

    if (response.status !== 200) {
      return c.json({ success: false, error: result.error?.message || 'Enrichment failed' }, response.status as 400);
    }

    // Log successful enrichment
    await logEnrichment(c.env.DB, user.organization_id, user.id, 'peopledatalabs', 'contact', params.email || params.linkedin_url || '', 'success', 1);

    const d = result.data;

    // Map PDL data to our contact fields (expanded)
    const enrichedData = {
      // Identity
      name: d.full_name || undefined,
      first_name: d.first_name || undefined,
      last_name: d.last_name || undefined,

      // Contact info
      email: d.work_email || d.personal_emails?.[0] || d.recommended_personal_email || undefined,
      work_email: d.work_email || undefined,
      personal_email: d.personal_emails?.[0] || d.recommended_personal_email || undefined,
      phone: d.mobile_phone || d.phone_numbers?.[0] || undefined,
      mobile_phone: d.mobile_phone || undefined,

      // Social profiles
      linkedin_url: d.linkedin_url || undefined,
      twitter_url: d.twitter_url || undefined,
      github_url: d.github_url || undefined,
      facebook_url: d.facebook_url || undefined,

      // Current job
      title: d.job_title || undefined,
      job_title_role: d.job_title_role || undefined,
      job_title_levels: d.job_title_levels || undefined,
      company_name: d.job_company_name || undefined,
      company_website: d.job_company_website || undefined,
      company_industry: d.job_company_industry || undefined,
      company_size: d.job_company_size || undefined,
      company_employee_count: d.job_company_employee_count || undefined,
      company_linkedin_url: d.job_company_linkedin_url || undefined,
      job_start_date: d.job_start_date || undefined,
      inferred_salary: d.inferred_salary || undefined,

      // Location
      location: d.location_name || undefined,
      location_locality: d.location_locality || undefined,
      location_region: d.location_region || undefined,
      location_country: d.location_country || undefined,

      // Demographics
      birth_year: d.birth_year || undefined,

      // Experience (last 3 jobs)
      experience: d.experience?.slice(0, 5).map(exp => ({
        title: exp.title?.name || undefined,
        company: exp.company?.name || undefined,
        company_website: exp.company?.website || undefined,
        company_industry: exp.company?.industry || undefined,
        start_date: exp.start_date || undefined,
        end_date: exp.end_date || undefined,
        is_current: exp.is_primary || undefined,
        location: exp.location_names?.[0] || undefined,
      })) || undefined,

      // Education
      education: d.education?.map(edu => ({
        school: edu.school?.name || undefined,
        degrees: edu.degrees || undefined,
        majors: edu.majors || undefined,
        start_date: edu.start_date || undefined,
        end_date: edu.end_date || undefined,
      })) || undefined,

      // Skills & interests
      skills: d.skills || undefined,
      interests: d.interests || undefined,
      languages: d.languages?.map(l => l.name).filter(Boolean) as string[] | undefined,
      industry: d.industry || undefined,

      // Certifications
      certifications: d.certifications?.map(cert => ({
        name: cert.name || undefined,
        organization: cert.organization || undefined,
      })) || undefined,
    };

    return c.json({
      success: true,
      data: {
        enriched: enrichedData,
        likelihood: result.likelihood, // 1-10 confidence score
        matched: result.matched, // which input fields matched
        raw: result.data, // Include raw data for advanced users
      }
    });
  } catch (error) {
    console.error('PDL contact enrichment error:', error);
    await logEnrichment(c.env.DB, user.organization_id, user.id, 'peopledatalabs', 'contact', params.email || params.linkedin_url || '', 'failed');
    return c.json({ success: false, error: 'Failed to enrich contact' }, 500);
  }
});

// Enrich a company using PDL
integrations.post('/enrich/company', zValidator('json', enrichCompanySchema), async (c) => {
  const user = c.get('user');
  const params = c.req.valid('json');

  if (!user.organization_id) {
    return c.json({ success: false, error: 'No organization found' }, 404);
  }

  const apiKey = await getPdlApiKey(c.env.DB, user.organization_id);
  if (!apiKey) {
    return c.json({
      success: false,
      error: 'People Data Labs integration not configured. Ask an admin to set it up in Settings > Integrations.'
    }, 400);
  }

  try {
    // Build PDL query parameters with expanded inputs
    const queryParams = new URLSearchParams();

    // Quality threshold - use 5 for good balance
    queryParams.set('min_likelihood', '5');
    // Include which fields matched
    queryParams.set('include_if_matched', 'true');

    // Website/domain - PDL expects full URL format
    if (params.website) {
      const website = params.website.includes('://') ? params.website : `https://${params.website}`;
      queryParams.set('website', website);
    }

    // Name
    if (params.name) queryParams.set('name', params.name);

    // LinkedIn profile
    const normalizedCompanyLinkedIn = normalizeLinkedInUrl(params.linkedin_url);
    if (normalizedCompanyLinkedIn) queryParams.set('profile', normalizedCompanyLinkedIn);

    // Stock ticker for public companies
    if (params.ticker) queryParams.set('ticker', params.ticker);

    console.log(`[PDL] Company enrichment request: ${queryParams.toString()}`);

    const response = await fetch(`https://api.peopledatalabs.com/v5/company/enrich?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    const resultText = await response.text();

    let result: PDLCompanyResponse;
    try {
      result = JSON.parse(resultText) as PDLCompanyResponse;
    } catch {
      console.error(`[PDL] Failed to parse response: ${resultText}`);
      return c.json({ success: false, error: 'Invalid response from People Data Labs' }, 500);
    }

    console.log(`[PDL] Company enrichment response: status=${response.status}, likelihood=${result.likelihood}, hasName=${!!result.name}`);

    if (response.status === 401 || response.status === 403) {
      return c.json({ success: false, error: 'Invalid API key' }, 401);
    }

    if (response.status === 402) {
      return c.json({ success: false, error: 'No API credits remaining' }, 402);
    }

    // Company enrichment returns fields at top level, not in data object
    if (response.status === 404 || !result.name) {
      await logEnrichment(c.env.DB, user.organization_id, user.id, 'peopledatalabs', 'company', params.website || params.name || '', 'no_match');
      return c.json({
        success: false,
        error: 'No matching company found. Make sure the website domain is correct or try using the company\'s LinkedIn URL.'
      }, 404);
    }

    if (response.status !== 200) {
      return c.json({ success: false, error: result.error?.message || 'Enrichment failed' }, response.status as 400);
    }

    // Log successful enrichment
    await logEnrichment(c.env.DB, user.organization_id, user.id, 'peopledatalabs', 'company', params.website || params.name || '', 'success', 1);

    // Map PDL data to our company fields (expanded)
    // Note: Company enrichment returns fields at top level, not in data object
    const enrichedData = {
      // Identity
      name: result.display_name || result.name || undefined,
      alternative_names: result.alternative_names || undefined,

      // Website
      website: result.website || undefined,
      domain: result.website?.replace(/^https?:\/\//, '').replace(/\/$/, '') || undefined,
      alternative_domains: result.alternative_domains || undefined,

      // Description
      headline: result.headline || undefined,
      description: result.summary || undefined,
      tags: result.tags || undefined,

      // Size & revenue
      employee_count: result.employee_count || undefined,
      size: result.size || undefined,
      inferred_revenue: result.inferred_revenue || undefined,

      // Industry
      industry: result.industry || undefined,
      naics_codes: result.naics?.map(n => n.code).filter(Boolean) as string[] | undefined,
      sic_codes: result.sic?.map(s => s.code).filter(Boolean) as string[] | undefined,

      // Social profiles
      linkedin_url: result.linkedin_url || undefined,
      twitter_url: result.twitter_url || undefined,
      facebook_url: result.facebook_url || undefined,

      // Company info
      founded: result.founded || undefined,
      type: result.type || undefined,
      ticker: result.ticker || undefined,

      // Location
      location: result.location?.name || undefined,
      location_locality: result.location?.locality || undefined,
      location_region: result.location?.region || undefined,
      location_country: result.location?.country || undefined,
      location_street_address: result.location?.street_address || undefined,
      location_postal_code: result.location?.postal_code || undefined,

      // Funding
      total_funding_raised: result.total_funding_raised || undefined,
      latest_funding_stage: result.latest_funding_stage || undefined,
      last_funding_date: result.last_funding_date || undefined,
      number_funding_rounds: result.number_funding_rounds || undefined,
      funding_stages: result.funding_stages || undefined,

      // Growth (if available)
      average_employee_tenure: result.average_employee_tenure || undefined,
      employee_growth_rate_12mo: result.employee_growth_rate?.['12_month'] || undefined,
    };

    return c.json({
      success: true,
      data: {
        enriched: enrichedData,
        likelihood: result.likelihood, // 1-10 confidence score
        matched: result.matched, // which input fields matched
        raw: result, // Include raw data for advanced users
      }
    });
  } catch (error) {
    console.error('PDL company enrichment error:', error);
    await logEnrichment(c.env.DB, user.organization_id, user.id, 'peopledatalabs', 'company', params.website || params.name || '', 'failed');
    return c.json({ success: false, error: 'Failed to enrich company' }, 500);
  }
});

// Check if enrichment is available for the org (for UI to show/hide enrich buttons)
integrations.get('/enrich/status', async (c) => {
  const user = c.get('user');

  if (!user.organization_id) {
    return c.json({ success: false, error: 'No organization found' }, 404);
  }

  const integration = await c.env.DB.prepare(
    'SELECT enabled FROM integrations WHERE organization_id = ? AND provider = ?'
  ).bind(user.organization_id, 'peopledatalabs').first<{ enabled: number }>();

  return c.json({
    success: true,
    data: {
      available: !!(integration?.enabled),
      provider: 'peopledatalabs'
    }
  });
});

export default integrations;
