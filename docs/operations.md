# Operations: Backup & Deployment

## Backup Strategy

### Database (Cloudflare D1)

**D1 Time Travel:** Cloudflare provides 30-day point-in-time restore on the free tier. Access via the Cloudflare dashboard under D1 > your database > Time Travel.

**Manual export (run before migrations or risky changes):**

```bash
npm run db:backup
```

This exports production D1 to `backups/crm-db-YYYYMMDD.sql`.

**Restore from backup:**

```bash
wrangler d1 execute crm-db --remote --file=backups/crm-db-YYYYMMDD.sql
```

### KV Cache

No backup needed. KV stores ephemeral session/cache data that rebuilds automatically.

### Code

Git is the backup. Push to remote regularly.

---

## Deployment

### Current Setup (Manual)

```bash
# Deploy API (Workers)
cd apps/api && wrangler deploy

# Deploy frontend (Pages)
cd apps/web && npm run build && wrangler pages deploy dist

# Deploy landing page
cd apps/landing && npm run build && wrangler pages deploy dist
```

### Recommended: Automated Deploys via GitHub Actions

Add `.github/workflows/deploy.yml`:

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: npm ci
      - run: npx wrangler deploy --config apps/api/wrangler.toml
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}

  deploy-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: npm ci
      - run: npm run build --workspace=apps/web
      - run: npx wrangler pages deploy apps/web/dist --project-name=satuso-web
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
```

**Setup:** Add `CF_API_TOKEN` to GitHub repo Settings > Secrets > Actions.

### Preview Deployments (Free Staging)

Connect the GitHub repo to Cloudflare Pages in the dashboard. Every non-main branch push gets a unique preview URL automatically — no separate staging environment needed.

### Database Migrations

1. `npm run db:backup` (always backup first)
2. Test locally: `npm run db:migrate`
3. Apply to production: `npm run db:migrate:prod`

---

## Rollback

| What broke | How to fix |
|------------|------------|
| Bad deploy (API/Web) | `git revert <commit>` and push to main |
| Bad migration | Restore from backup SQL file or use D1 Time Travel |
| Lost data | D1 Time Travel (30-day window) |

---

## Cost

Everything above is free:
- Cloudflare Workers/Pages/D1/KV free tiers
- GitHub Actions (2,000 minutes/month free)
- Cloudflare Pages preview deployments (unlimited)

## When You Have Customers

Consider adding:
- Dedicated staging D1 database (`[env.staging]` in wrangler.toml)
- CI gates (lint, typecheck, tests must pass before deploy)
- Scheduled automated backups
- Monitoring/alerting
