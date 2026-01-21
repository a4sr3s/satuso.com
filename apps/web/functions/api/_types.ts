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
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    organization_id?: string;
  };
}
