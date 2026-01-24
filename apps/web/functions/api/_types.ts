export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  ENVIRONMENT: string;
  GROQ_API_KEY?: string;
  CLERK_SECRET_KEY: string;
  CLERK_PUBLISHABLE_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRICE_ID: string;
}

export interface Variables {
  userId: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    organization_id?: string;
    subscription_status?: string;
  };
}
