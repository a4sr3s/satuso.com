import type { D1Database, KVNamespace } from '@cloudflare/workers-types';

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  ENVIRONMENT: string;
  GROQ_API_KEY?: string;
  CLERK_SECRET_KEY: string;
  CLERK_PUBLISHABLE_KEY: string;
}

export interface Variables {
  userId: string;
  orgId?: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    organization_id?: string;
    org_id?: string;
  };
}
