import { nanoid } from 'nanoid';
import type { D1Database } from '@cloudflare/workers-types';
import { createContactSchema, createCompanySchema, createDealSchema } from '../schemas';

export interface CreateContactInput {
  name: string;
  email?: string;
  phone?: string;
  title?: string;
  companyId?: string;
  ownerId?: string;
  status?: 'active' | 'inactive' | 'lead';
  source?: string;
  linkedinUrl?: string;
}

export interface CreateCompanyInput {
  name: string;
  domain?: string;
  industry?: string;
  employee_count?: number;
  annual_revenue?: number;
  website?: string;
  description?: string;
}

export interface CreateDealInput {
  name: string;
  value?: number;
  stage?: 'lead' | 'qualified' | 'discovery' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
  close_date?: string;
  company_id?: string;
  contact_id?: string;
}

export async function createContactRecord(
  db: D1Database,
  data: CreateContactInput,
  userId: string,
  orgId?: string
) {
  const parsed = createContactSchema.parse(data);
  const id = nanoid();
  const now = new Date().toISOString();

  await db.prepare(`
    INSERT INTO contacts (id, name, email, phone, title, company_id, owner_id, status, source, linkedin_url, org_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    parsed.name,
    parsed.email || null,
    parsed.phone || null,
    parsed.title || null,
    parsed.companyId || null,
    parsed.ownerId || userId,
    parsed.status || 'active',
    parsed.source || null,
    parsed.linkedinUrl || null,
    orgId || null,
    now,
    now
  ).run();

  const contact = await db.prepare('SELECT * FROM contacts WHERE id = ?').bind(id).first();
  return contact;
}

export async function createCompanyRecord(
  db: D1Database,
  data: CreateCompanyInput,
  userId: string,
  orgId?: string
) {
  const parsed = createCompanySchema.parse(data);
  const id = nanoid();
  const now = new Date().toISOString();

  await db.prepare(`
    INSERT INTO companies (id, name, domain, industry, employee_count, annual_revenue, website, description, owner_id, org_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    parsed.name,
    parsed.domain || null,
    parsed.industry || null,
    parsed.employee_count || null,
    parsed.annual_revenue || null,
    parsed.website || null,
    parsed.description || null,
    userId,
    orgId || null,
    now,
    now
  ).run();

  const company = await db.prepare('SELECT * FROM companies WHERE id = ?').bind(id).first();
  return company;
}

export async function createDealRecord(
  db: D1Database,
  data: CreateDealInput,
  userId: string,
  orgId?: string
) {
  const parsed = createDealSchema.parse(data);
  const id = nanoid();
  const now = new Date().toISOString();

  await db.prepare(`
    INSERT INTO deals (id, name, value, stage, contact_id, company_id, owner_id, close_date, spin_progress, org_id, stage_changed_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    parsed.name,
    parsed.value || 0,
    parsed.stage || 'lead',
    parsed.contact_id || null,
    parsed.company_id || null,
    userId,
    parsed.close_date || null,
    0,
    orgId || null,
    now,
    now,
    now
  ).run();

  const deal = await db.prepare('SELECT * FROM deals WHERE id = ?').bind(id).first();
  return deal;
}
