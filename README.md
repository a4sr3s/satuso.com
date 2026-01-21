# Satuso - AI-First CRM

Satuso is a modern, AI-first CRM built entirely on Cloudflare's edge infrastructure. It features SPIN selling methodology integration, natural language AI queries, and a clean Cloudflare-inspired design.

## Features

- **Dashboard** - Real-time metrics, activity feed, and AI insights
- **Contacts & Companies** - Full contact and account management
- **Deals Pipeline** - Kanban-style deal tracking with drag-and-drop
- **SPIN Selling** - Built-in SPIN methodology with auto-extraction from notes
- **AI Assistant** - Natural language queries and deal insights
- **Tasks** - Task management with due dates and priorities

## Tech Stack

- **Frontend**: React 18, Vite, TailwindCSS, React Query, React Router
- **Backend**: Cloudflare Workers (Hono framework)
- **Database**: Cloudflare D1 (SQLite)
- **Cache**: Cloudflare KV
- **Storage**: Cloudflare R2
- **AI**: Cloudflare Workers AI (Llama 3.1)
- **Vector Search**: Cloudflare Vectorize

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account

### Installation

```bash
# Install dependencies
npm install

# Login to Cloudflare
wrangler login

# Create D1 database
wrangler d1 create crm-db

# Update wrangler.toml with your database ID

# Create KV namespace
wrangler kv:namespace create KV

# Update wrangler.toml with your KV namespace ID
```

### Local Development

```bash
# Start API (runs on port 8787)
cd apps/api
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your JWT secret
wrangler d1 migrations apply crm-db --local
npm run dev

# Start frontend (runs on port 5173)
cd apps/web
npm run dev
```

### Database Migrations

```bash
# Apply migrations locally
cd apps/api
wrangler d1 migrations apply crm-db --local

# Apply migrations to production
wrangler d1 migrations apply crm-db --remote
```

### Deployment

```bash
# Deploy API
cd apps/api
wrangler deploy

# Deploy frontend (Cloudflare Pages)
cd apps/web
npm run build
wrangler pages deploy dist --project-name satuso
```

## Project Structure

```
satuso/
├── apps/
│   ├── api/                 # Cloudflare Workers API
│   │   ├── src/
│   │   │   ├── routes/      # API routes
│   │   │   ├── middleware/  # Auth, CORS
│   │   │   └── services/    # Business logic
│   │   ├── migrations/      # D1 migrations
│   │   └── wrangler.toml    # Cloudflare config
│   │
│   └── web/                 # React frontend
│       ├── src/
│       │   ├── components/  # UI components
│       │   ├── pages/       # Page components
│       │   ├── hooks/       # Custom hooks
│       │   ├── lib/         # Utilities
│       │   └── stores/      # Zustand stores
│       └── vite.config.ts
│
├── packages/
│   └── shared/              # Shared TypeScript types
│
└── turbo.json               # Turborepo config
```

## Demo Credentials

- Email: `demo@satuso.com`
- Password: `demo123`

## Design System

Satuso uses a Cloudflare-inspired design system:

- **Primary**: `#F6821F` (Orange)
- **Background**: `#FFFFFF` / `#F9FAFB`
- **Text**: `#1D1D1D` / `#6B7280` / `#9CA3AF`
- **Border**: `#E5E7EB`
- **Success**: `#10B981`
- **Error**: `#EF4444`

## API Endpoints

- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register
- `GET /api/contacts` - List contacts
- `GET /api/companies` - List companies
- `GET /api/deals` - List deals
- `GET /api/deals/pipeline` - Get pipeline (Kanban)
- `POST /api/ai/extract-spin` - Extract SPIN insights
- `POST /api/ai/query` - Natural language query
- `GET /api/dashboard/metrics` - Dashboard metrics

## License

MIT
