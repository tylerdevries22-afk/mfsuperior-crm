# MF Superior · CRM

CRM and email automation for MF Superior Products freight box trucks.

## Stack

- Next.js 16 App Router · TypeScript · React 19
- Tailwind 4 (CSS-first `@theme inline` tokens) · custom UI primitives
- Drizzle ORM · Vercel Postgres (Neon) · `@neondatabase/serverless`
- Auth.js v5 · Google provider (Gmail + Drive + Calendar scopes share one OAuth client)
- Email: Gmail API (drafts default, auto-send opt-in per template step)
- Storage: Google Drive API (`drive.file`, single configured folder, two-way sync — pulls from any `*Lead*.xlsx` and pushes the canonical `MFS_Leads_Synced.xlsx` every hour)
- Calendar: Google Calendar API (`calendar.events`) — schedule follow-ups directly from a lead detail page
- Vitest · Playwright

## First-time setup

```bash
cp .env.example .env.local
# fill in the REQUIRED block; see "Environment variables" below

npm run env:check         # validates .env.local against src/lib/env.ts
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

## Environment variables

Single source of truth: `src/lib/env.ts` (zod schema). `.env.example` mirrors
it. Every var in the table below must be set in **all three** Vercel
environments (Production, Preview, Development) and in your local
`.env.local`. Drift between them is the #1 cause of "works locally, breaks on
deploy" bugs.

### Required

| Var | Why | Example / generator |
|---|---|---|
| `DATABASE_URL` | Postgres connection (Neon pooler URL in prod) | `postgres://…?sslmode=require` |
| `AUTH_SECRET` | Auth.js session encryption | `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` | Google OAuth client (Gmail + Drive + Calendar) | from Google Cloud Console |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret | from Google Cloud Console |
| `APP_URL` | Public origin — used for redirects, tracking pixels, unsubscribe links | `http://localhost:3000` / `https://your-domain.com` |
| `CRON_SECRET` | Bearer token for `/api/cron/*` | `openssl rand -hex 16` |
| `ENCRYPTION_KEY` | AES key for OAuth refresh tokens at rest | `openssl rand -base64 32` |
| `BUSINESS_NAME` | Compliance footer + email signature | `MF Superior Solutions` |
| `BUSINESS_ADDRESS` | Compliance footer (CAN-SPAM physical address) | `15321 E Louisiana Ave, …` |

### Optional

`RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `GMAIL_USER`, `DRIVE_FOLDER_ID`,
`BUSINESS_MC`, `BUSINESS_USDOT`, `DAILY_SEND_CAP` (default 20), `WARMUP_DAYS`
(default 7), `WARMUP_DAILY_CAP` (default 5).

### Validate locally

```bash
npm run env:check                 # validates .env.local
npm run env:check -- .env         # any other path
```

The checker prints required (✓/✗), optional (·/✓), and any **drift** —
unrecognized keys in your file that aren't in the schema.

### Validate Vercel

```bash
npx vercel link                                  # one-time: link the repo
npx vercel env ls production                     # list prod vars
npx vercel env ls preview
npx vercel env ls development

# Pull every var for a given environment into a local file, then run the
# checker against it to confirm parity with the schema.
npx vercel env pull .env.production --environment=production
npm run env:check -- .env.production

npx vercel env pull .env.preview --environment=preview
npm run env:check -- .env.preview
```

Add or update a var:

```bash
npx vercel env add APP_URL production           # prompts for the value
npx vercel env add APP_URL preview
npx vercel env add APP_URL development
# or via dashboard: Project → Settings → Environment Variables
```

Per-environment values that should differ:

| Var | Production | Preview | Development |
|---|---|---|---|
| `APP_URL` | `https://your-domain.com` | the preview URL (or leave the prod URL — Auth.js uses `VERCEL_URL` for callbacks) | `http://localhost:3000` |
| `DATABASE_URL` | prod branch | preview/staging branch | dev branch (or local) |
| `RESEND_API_KEY` | live key | sandbox key (or unset) | unset / sandbox |
| `NODE_ENV` | (Vercel sets automatically) | (Vercel sets automatically) | (Vercel sets automatically) |

All other required vars (`AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`,
`CRON_SECRET`, `ENCRYPTION_KEY`, `BUSINESS_NAME`, `BUSINESS_ADDRESS`) should be
identical across all three Vercel environments.

> **Auth.js v5 on Vercel:** `AUTH_URL` is auto-detected from `VERCEL_URL`, so
> you only need to set it explicitly if you serve from a custom domain that
> Auth.js can't infer. `AUTH_TRUST_HOST` is implicit on Vercel.

Google OAuth client (https://console.cloud.google.com/apis/credentials):

- Authorized redirect URI: `${APP_URL}/api/auth/callback/google`
- Scopes requested at sign-in: `openid email profile gmail.compose gmail.send gmail.readonly drive.file calendar.events`
- Enable APIs in the same Google Cloud project: **Gmail API**, **Google Drive API**, **Google Calendar API**.

If you already connected Google before the Calendar scope was added: open `myaccount.google.com/permissions`, revoke this app, then sign in again so the new scope is granted. Settings → Google integrations shows which scopes are live.

Drive folder: open `drive.google.com`, create a folder for the CRM (e.g. "MFS CRM"), copy the ID from the URL, and paste it under Settings → Drive folder ID. Hourly sync pulls any `*Lead*.xlsx` into the DB and writes the canonical `MFS_Leads_Synced.xlsx` back to that folder.

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
| `npm run env:check` | Validate `.env.local` against `src/lib/env.ts` |
| `npm run env:pull` | `vercel env pull .env.local` shorthand |

## Routes (current)

- `/` — redirects based on auth
- `/login` — Google sign-in
- `/dashboard` — KPIs (placeholder until features land)
- `/settings` — business identity, sender profile, sending limits, Drive folder

Routes coming in subsequent build steps: `/leads`, `/leads/import`, `/sequences`, `/templates`, `/inbox`, `/admin`, plus `/api/cron/*`, `/api/track/*`, `/api/unsubscribe/*`.

## Brand

Visual identity matches the MF Superior Products logo: electric cobalt blue (`oklch(0.48 0.30 258)`, ~`#1747D6`) on near-black + white canvas. Tokens live in `src/app/globals.css`. Geist + Geist Mono throughout. No gradients, no chrome — daily-use CRM, not a marketing site.
