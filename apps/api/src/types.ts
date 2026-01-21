import type { D1Database, KVNamespace, R2Bucket, Queue, Vectorize, Ai } from '@cloudflare/workers-types';

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
  QUEUE: Queue;
  VECTORIZE: Vectorize;
  AI: Ai;
  JWT_SECRET: string;
  ENVIRONMENT: string;
  GROQ_API_KEY: string;
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
