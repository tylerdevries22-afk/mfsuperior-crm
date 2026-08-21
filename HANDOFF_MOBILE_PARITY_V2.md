# MF Superior Products Mobile Parity V2 — Agent Handoff

Last updated: 2026-08-21  
Working branch: `codex/mobile-parity-v2`  
First durable checkpoint: `f8ec099`  
Remote: `origin` (`tylerdevries22-afk/mfsuperior-crm`)

## Objective and immutable baseline

Rebuild `mobile/` to match the Appliance Diagnostic Expo app screen-for-screen while tailoring content and artwork to freight operations. The visual source of truth is:

- Repository: `/Users/tylerdevries/Dev/appliance-diagnostic-systems`
- Mobile source: `/Users/tylerdevries/Dev/appliance-diagnostic-systems/artifacts/mobile`
- Pinned commit: `480991b7eb0036e4e85c37d3784b2de2ca97d10d`
- Canonical device: iPhone 16 Pro, 393×852 logical pixels, iOS 26, dark appearance, default text size, Expo Go

Do not silently move the baseline to a later reference commit. Approved visual deviations are MF lime branding, freight terminology/data, original freight artwork, and semantic status colors.

## Completed in the checkpoint

- Ported separate reference-derived UI primitives: animated pressables/buttons/cards, glass/workspace cards, drawer, sheet, timeline, carousel, headers, badges, legacy/current token families, native tabs, and iOS material configuration.
- Rebuilt Login, Home, Profile, role navigation, auth callback, recovery, and TOTP MFA surfaces.
- Added direct freight routes for the 66-route parity manifest and removed the generic `feature/[slug]` facade.
- Added original optimized freight artwork under `mobile/assets/freight/` and MF brand assets under `mobile/assets/brand/`.
- Replaced the runtime role vocabulary with `admin | driver | customer`; there are no remaining `dispatcher` occurrences in runtime, tests, environment declarations, or docs.
- Removed operational demo banners. Demo labeling is restricted to Login and Profile.
- Added Supabase PKCE auth, secure chunked session storage, verified callback/recovery handling, refresh support, and MFA helpers.
- Added tenant-backed Neon organization memberships and `MobilePrincipal` authorization; carrier APIs now fail closed and scope database queries to the selected organization/carrier membership.
- Added `/api/auth/sync` and `/api/mobile/v1` bootstrap, sync, shipments, requests, mutation, and signed-upload endpoints using `{ data, error, meta }` envelopes.
- Added persistent authenticated rate limits, strict request parsing, CSRF/origin checks, idempotency receipts, outbox records, private upload intent contracts, and structured safe errors.
- Added provider-scoped `shipment_external_references` and removed the legacy Target-only uniqueness index in additive migration `0005_little_caretaker.sql`.
- Added seven honest partner capability contracts, a bounded X12 boundary for 204/990/214/210/997, safe adapter retry/idempotency rules, and file magic-byte/size validation.
- Added `EXPO_PUBLIC_MOBILE_PARITY_V2=true` as a fail-closed production cutover gate.
- Added machine-readable manifest and filesystem/partner/spec/detail contract tests.

## Verification already passing

- Mobile TypeScript: `cd mobile && npm run typecheck`
- Mobile ESLint: `cd mobile && npm run lint`
- Focused mobile parity/network/adapter tests: 26/26
- Manifest and route contracts: 24/24 in the agent verification pass
- Backend partner/X12/security tests: 20/20
- Backend TypeScript: passed with `npx tsc --noEmit --incremental false`
- Backend focused authorization/API tests: 13/13
- Earlier complete web test pass: 76 passed, 14 skipped
- `git diff --check`: clean at checkpoint

The Jest process can retain an Expo test handle after reporting success. Use `--watchman=false --forceExit` for the current suite and separately investigate with `--detectOpenHandles`; do not mistake the retained handle for a failing assertion.

## Immediate next work, in order

1. Finish wiring `mobile/store/ProductionOperationsRepository.ts` to the real `/api/mobile/v1` envelope and `productionStateAdapter.ts`. Current repository URLs and mutation shapes still reflect the earlier aggregate prototype.
2. Align mobile offline queue kinds with backend versioned mutations for driver duty status, shipment status, location, exception, photo, signature, and POD. Preserve FIFO per shipment and conflict/idempotency semantics.
3. Implement pending self-registered customer access: create a pending access request/membership through `/api/auth/sync`, allow request submission, and deny shipment visibility until an admin links a customer company.
4. Make server-derived Neon membership role the UI role after sync. Supabase metadata must never authorize access.
5. Remove the remaining legacy Target-shaped API response names from the mobile API; dual-read legacy DB columns may remain only for rollback migration.
6. Finish tenant backfill/validation constraints for operational rows and seed the MF Superior organization plus the initial `info@mfsuperiorproducts.com` admin invitation.
7. Run native reference/MF captures on iPhone 16 Pro and close measured typography/spacing/component diffs. Web screenshots are not a release substitute.
8. Add Maestro journeys, screenshot masks/threshold checks, accessibility automation, Playwright staging coverage, mutation testing, health checks, and CI gates from the approved plan.
9. Run the complete final suite: mobile lint/typecheck/Jest/Expo Doctor/export, web lint/typecheck/Vitest/build/Playwright, audits, secret scan, bundle and asset budgets.

## External blockers requiring Tyler

Supabase staging and production provisioning through the Vercel Marketplace reached the mandatory Vercel terms-acceptance screen. Tyler must accept:

`https://vercel.com/tylerdevries222s-projects/~/integrations/accept-terms/supabase?source=cli`

Then run or resume:

```bash
npx vercel integration add supabase --name mf-superior-products-production --plan free -m region=sfo1 -e production --no-claim --json
npx vercel integration add supabase --name mf-superior-products-staging --plan free -m region=sfo1 -e preview -e development --no-claim --json
```

No Target private EDI companion guides, identifiers, transports, UAT package, or credentials are available. Target must remain labeled `Portal available · EDI onboarding required`. The other six surfaced partners remain `Credentials required` until successful UAT.

## Production environment contract

Mobile public configuration:

```bash
EXPO_PUBLIC_MOBILE_PARITY_V2=true
EXPO_PUBLIC_API_BASE_URL=https://YOUR_APP/api/mobile
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Server configuration additionally needs Supabase server/storage credentials, `MOBILE_ALLOWED_ORIGINS`, Resend SMTP settings, encryption key/version settings, Neon `DATABASE_URL`, and the private storage bucket. Never put a Supabase service-role key in Expo public variables.

## Git checkpoint protocol

Continue on `codex/mobile-parity-v2`. After each coherent slice:

```bash
git diff --check
git status --short
git add -A
git commit -m "feat: <specific parity slice>"
git push origin codex/mobile-parity-v2
```

Do not rewrite or force-push the branch. Preserve unrelated user changes. Update this handoff after verification results or blockers change.
