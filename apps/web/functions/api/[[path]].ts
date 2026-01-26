import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { createCorsMiddleware } from './_middleware/cors';

// Import route modules - these will be copied during build
import auth from './_routes/auth';
import contacts from './_routes/contacts';
import companies from './_routes/companies';
import deals from './_routes/deals';
import activities from './_routes/activities';
import tasks from './_routes/tasks';
import dashboard from './_routes/dashboard';
import ai from './_routes/ai';
import search from './_routes/search';
import workboards from './_routes/workboards';
import organizations from './_routes/organizations';
import billing from './_routes/billing';
import notifications from './_routes/notifications';

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

const app = new Hono<{ Bindings: Env; Variables: Variables }>().basePath('/api');

// Middleware
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', async (c, next) => {
  const corsHandler = createCorsMiddleware(c.env);
  return corsHandler(c, next);
});

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

// API Routes
app.route('/auth', auth);
app.route('/contacts', contacts);
app.route('/companies', companies);
app.route('/deals', deals);
app.route('/activities', activities);
app.route('/tasks', tasks);
app.route('/dashboard', dashboard);
app.route('/ai', ai);
app.route('/search', search);
app.route('/workboards', workboards);
app.route('/organizations', organizations);
app.route('/billing', billing);
app.route('/notifications', notifications);

// 404 handler
app.notFound((c) => {
  return c.json({ success: false, error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  const isDev = c.env.ENVIRONMENT === 'development';
  return c.json(
    {
      success: false,
      error: isDev ? err.message : 'Internal server error',
    },
    500
  );
});

export const onRequest = handle(app);
