# Claude Code Instructions for Satuso CRM

## Project Structure
- `apps/web/` - React + Vite + Tailwind frontend
- `apps/api/` - Hono + Cloudflare Workers + D1 backend
- `apps/landing/` - Astro landing page
- `packages/shared/` - Shared TypeScript types

## Deployment

### Web App (apps/web)
After making changes, always deploy:

```bash
# 1. Build and verify no errors
cd apps/web && npm run build

# 2. Commit changes
git add <files>
git commit -m "Description of changes

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

# 3. Push to git
git push origin main

# 4. Deploy to Cloudflare Pages
cd apps/web && npx wrangler pages deploy dist
```

### API (apps/api)
```bash
cd apps/api && npx wrangler deploy
```

### Database Migrations
```bash
# Local
npm run db:migrate

# Production
npm run db:migrate:prod
```

## Build Commands
- `npm run dev` - Start all apps in development
- `npm run build` - Build all apps
- `npm run lint` - Lint all apps

## Important Notes
- Always run build before deploying to catch type errors
- Commit changes before deploying (wrangler warns about uncommitted changes)
- The web app deploys to Cloudflare Pages
- The API deploys to Cloudflare Workers
