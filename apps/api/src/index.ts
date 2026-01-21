import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import type { Env, Variables } from './types';
import { corsMiddleware } from './middleware/cors';
import { standardRateLimiter } from './middleware/rate-limit';

// Routes
import auth from './routes/auth';
import contacts from './routes/contacts';
import companies from './routes/companies';
import deals from './routes/deals';
import activities from './routes/activities';
import tasks from './routes/tasks';
import dashboard from './routes/dashboard';
import ai from './routes/ai';
import search from './routes/search';
import workboards from './routes/workboards';
import organizations from './routes/organizations';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Middleware
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', corsMiddleware);
// Apply standard rate limiting to all API routes
app.use('/api/*', standardRateLimiter);

// Health check
app.get('/', (c) => {
  return c.json({
    name: 'Satuso API',
    version: '0.1.0',
    status: 'healthy',
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

// API Routes
app.route('/api/auth', auth);
app.route('/api/contacts', contacts);
app.route('/api/companies', companies);
app.route('/api/deals', deals);
app.route('/api/activities', activities);
app.route('/api/tasks', tasks);
app.route('/api/dashboard', dashboard);
app.route('/api/ai', ai);
app.route('/api/search', search);
app.route('/api/workboards', workboards);
app.route('/api/organizations', organizations);

// 404 handler
app.notFound((c) => {
  return c.json({ success: false, error: 'Not found' }, 404);
});

// Error handler - don't leak implementation details in production
app.onError((err, c) => {
  console.error('Error:', err);

  // Only show detailed errors in development
  const isDev = c.env.ENVIRONMENT === 'development';

  return c.json(
    {
      success: false,
      error: isDev ? err.message : 'Internal server error',
    },
    500
  );
});

// Queue consumer for background jobs
export default {
  fetch: app.fetch,

  async queue(batch: MessageBatch<any>, env: Env) {
    for (const message of batch.messages) {
      const { type, ...data } = message.body;

      try {
        switch (type) {
          case 'extract_spin':
            // Process SPIN extraction from call transcript
            const { activityId, transcript } = data;

            const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct' as any, {
              messages: [
                {
                  role: 'system',
                  content: `Extract SPIN selling insights from this call transcript.
Return JSON: { "situation": [], "problem": [], "implication": [], "needPayoff": [] }`,
                },
                { role: 'user', content: transcript },
              ],
            });

            // Parse and store
            const responseText = (response as any).response || '';
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const insights = JSON.parse(jsonMatch[0]);
              await env.DB.prepare(`
                UPDATE activities SET spin_tags = ?, updated_at = ? WHERE id = ?
              `).bind(JSON.stringify(insights), new Date().toISOString(), activityId).run();
            }
            break;

          case 'enrich_contact':
            // Placeholder for contact enrichment
            break;

          case 'send_notification':
            // Placeholder for notification sending
            break;

          default:
            console.warn('Unknown job type:', type);
        }

        message.ack();
      } catch (error) {
        console.error('Job processing error:', error);
        message.retry();
      }
    }
  },
};
