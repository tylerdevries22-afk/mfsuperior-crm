# MF Superior · CRM

CRM and email automation for MF Superior Products freight box trucks.

## Stack

- Next.js 16 App Router · TypeScript · React 19
- Tailwind 4 (CSS-first `@theme inline` tokens) · custom UI primitives
- Drizzle ORM · Vercel Postgres (Neon) · `@neondatabase/serverless`
- Auth.js v5 · Google provider (Gmail + Drive scopes share one OAuth client)
- Email: Gmail API (drafts default, auto-send opt-in per template step)
- Storage: Google Drive API (`drive.file`, single configured folder, two-way conservative sync)
- Vitest · Playwright

## First-time setup

```bash
cp .env.example .env.local
# fill in DATABASE_URL, AUTH_GOOGLE_ID/SECRET, AUTH_SECRET, ENCRYPTION_KEY, CRON_SECRET

npm run db:generate
npm run db:push
npm run dev
```

Generate secrets:

```bash
openssl rand -base64 32   # AUTH_SECRET
openssl rand -base64 32   # ENCRYPTION_KEY
openssl rand -hex 16      # CRON_SECRET
```

Google OAuth client (https://console.cloud.google.com/apis/credentials):

- Authorized redirect URI: `${APP_URL}/api/auth/callback/google`
- Scopes requested at sign-in: `openid email profile gmail.compose gmail.send gmail.readonly drive.file`

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Next dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests (one-shot) |
| `npm run test:watch` | Vitest watch |
| `npm run test:e2e` | Playwright E2E |
| `npm run db:generate` | Drizzle migration SQL from schema |
| `npm run db:push` | Apply schema to `DATABASE_URL` (dev) |
| `npm run db:studio` | Drizzle Studio |

## Routes (current)

- `/` — redirects based on auth
- `/login` — Google sign-in
- `/dashboard` — KPIs (placeholder until features land)
- `/settings` — business identity, sender profile, sending limits, Drive folder

Routes coming in subsequent build steps: `/leads`, `/leads/import`, `/sequences`, `/templates`, `/inbox`, `/admin`, plus `/api/cron/*`, `/api/track/*`, `/api/unsubscribe/*`.

## Brand

Visual identity matches the MF Superior Products logo: electric cobalt blue (`oklch(0.48 0.30 258)`, ~`#1747D6`) on near-black + white canvas. Tokens live in `src/app/globals.css`. Geist + Geist Mono throughout. No gradients, no chrome — daily-use CRM, not a marketing site.
