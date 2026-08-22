# MF Superior Products Mobile Parity V2 — Agent Handoff

Last updated: 2026-08-21  
Working branch: `codex/mobile-parity-v2`  
First durable checkpoint: `f8ec099`  
Latest feature checkpoint at this update: `2e8d680`
Remote: `origin` (`tylerdevries22-afk/mfsuperior-crm`)

## Objective and immutable baseline

Rebuild `mobile/` to match the Appliance Diagnostic Expo app screen-for-screen while tailoring content and artwork to freight operations. The visual source of truth is:

- Repository: `/Users/tylerdevries/Dev/appliance-diagnostic-systems`
- Mobile source: `/Users/tylerdevries/Dev/appliance-diagnostic-systems/artifacts/mobile`
- Pinned commit: `480991b7eb0036e4e85c37d3784b2de2ca97d10d`
- Requested canonical device: iPhone 16 Pro, 393×852 logical pixels, iOS 26, dark appearance, default text size, Expo Go

Do not silently move the baseline to a later reference commit. Approved visual deviations are MF lime branding, freight terminology/data, original freight artwork, and semantic status colors.

The native audit found an acceptance-contract conflict: Apple’s iPhone 16 Pro simulator on installed iOS 26.5 renders at 402×874 logical points (1206×2622 pixels), not 393×852. A future agent must get Tyler’s choice of physical device geometry before recording ±1-point/0.5% pixel acceptance; do not relabel a 402×874 capture as 393×852.

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
- Wired production bootstrap, shipment, and request hydration through `/api/mobile/v1` envelopes and the production state adapter; runtime role/identity is now derived from the server payload.
- Neutralized Target-specific operational demo content and renamed mobile carrier fields/actions to provider-neutral freight names. Shipment detail responses now expose an explicit safe mobile projection rather than returning raw Target/EDI columns.
- Switched Inter and icon imports to the exact used weights/families. The all-platform export now contains 74 assets/18 MB instead of 136 assets/35 MB.
- Added verified-email customer self-registration as a `customer/pending` membership plus access request. Pending users can read/create only their own freight requests; MFA-authenticated admins can approve/reject idempotently, and approval links a same-tenant customer account before shipment access. Admins and drivers remain invitation-only.
- Aligned the mobile offline queue with the real `v1/mutations` contract for duty status, shipment status, location, exception, photo, signature, and POD, preserving FIFO per shipment and conflict/idempotency semantics.
- Made `/api/auth/sync` the mobile identity source of truth. `SupabaseAuthService` no longer reads `app_metadata.role`; role, organization, carrier/driver/customer linkage, and access state now come from the server through `ApiMembershipSyncGateway`, and the payload is re-validated on the client before it can grant anything.
- Added the `pending_customer_approval` surface: `app/pending-approval.tsx` is the only protected screen a `customer/pending` membership can reach, hydrated from `/v1/requests` alone because bootstrap and shipments stay refused server-side.
- Replaced the prototype online write URLs with real routes: `POST /v1/shipments/[id]/tender-response`, `POST /v1/shipments/[id]/assignment`, `POST /v1/exceptions/[id]/resolution`, `GET /v1/exceptions`, `GET|POST /v1/messages`, and `POST /v1/messages/[id]/read`. All are idempotency-keyed, tenant-scoped, rate-limited, and return the `{ data, error, meta }` envelope.
- Added tenant-scoped operational messaging (`operations_messages`, `operations_message_reads`) in additive migration `0008_operations_messages.sql`, plus a bootstrap contact directory scoped by role (admins see the active roster, drivers and customers see only admins).
- Added `freight_requests.subject` and `freight_requests.request_type` in additive migration `0009_freight_request_intake.sql` so mobile request intake round-trips faithfully instead of overloading `reference_number`/`commodity`. The mobile request form now collects the pickup and delivery addresses the API requires.
- Made the surfaces with no production backing fail closed instead of posting to URLs that do not exist: intermediate-stop advance and tractor/trailer assignment now raise structured domain errors.

## Verification already passing (re-run at this checkpoint)

Re-run and green at this checkpoint:

- Mobile TypeScript: `cd mobile && npm run typecheck` — clean
- Mobile ESLint: `cd mobile && npm run lint` — zero warnings
- Complete mobile Jest suite: 17 suites, 87/87 assertions
- Backend TypeScript: `npx tsc --noEmit --incremental false` — clean
- Web ESLint: `npm run lint` — zero warnings
- Complete web Vitest suite: 103 passed, 14 skipped (13 files, 2 skipped)
- Backend mobile-API contract tests (`tests/unit/carrier-api.test.ts`): 20/20
- `git diff --check`: clean at checkpoint

Carried forward from the prior checkpoint and **not** re-run at this one:

- Manifest and route contracts: 24/24
- Expo Doctor: 21/21 checks passed
- Expo all-platform export: passed
- iOS Hermes export: 3.9 MB; Android Hermes export: 4.2 MB; exported assets total: 18 MB
- Web production build: `npx next build --webpack` passed, including TypeScript, static generation, and route collection

The Jest process can retain an Expo test handle after reporting success. Use `--watchman=false --forceExit` for the current suite and separately investigate with `--detectOpenHandles`; do not mistake the retained handle for a failing assertion.

Known dependency-audit results: mobile has four high `image-size` findings through archived Metro tooling plus ten moderate Expo-tooling `uuid` findings; `npm audit fix --force` would incorrectly downgrade Expo to 46 and must not be used. Web has six moderate transitive advisories. Follow the approved vendor-guard/expiry-exception path if no compatible Expo/Metro patch is available.

The default Turbopack production build panics in this Codex host while PostCSS tries to bind a helper port (`Operation not permitted`). The webpack production build succeeds, so this is currently classified as a host/Turbopack execution restriction rather than an application compile failure. Recheck the default build in CI/Vercel.

## Immediate next work, in order

Items 1, 2, and 3 are complete and pushed. The remaining order is:

1. **(Done)** Offline queue aligned with `v1/mutations`.
2. **(Done)** `/api/auth/sync` is the mobile identity source of truth and `pending_customer_approval` renders.
3. **(Done)** Production online mutation/message routes implemented; the only writes that still refuse are the two with no server-side model (intermediate stops, tractor/trailer assignment), and they now fail closed with structured errors instead of hitting missing URLs.
4. Finish tenant backfill/validation constraints for operational rows and seed the MF Superior organization plus the initial `info@mfsuperiorproducts.com` admin invitation. Migrations `0008` and `0009` are generated but have not been applied to any database — no Neon/Supabase project is provisioned yet.
5. Resolve the canonical simulator geometry, then capture both apps natively and close measured typography/spacing/component diffs. The current MF login sheet and monolithic role-home composition are source-inspection parity risks. Web screenshots are not a release substitute.
6. Add Maestro journeys, screenshot masks/threshold checks, accessibility automation, Playwright staging coverage, mutation testing, health checks, and CI gates from the approved plan.
7. Run the complete final suite after pending backend edits: mobile lint/typecheck/Jest/Expo Doctor/export, web lint/typecheck/Vitest/build/Playwright, audits, secret scan, bundle and asset budgets.

### Known limitations recorded honestly

- `shipment_events` records `driver_id` but not a general actor user id, so an admin-reported exception has no reporter attribution. The mobile `ExceptionReport.reportedByAccountId` is the driver id when present and an empty string otherwise.
- `shipments.intermediate_stops` exists as JSONB but nothing writes it and the mobile projection only builds a pickup and a delivery stop, so `advanceIntermediateStop` fails closed rather than pretending.
- There is no server-side equipment registry, so `assignShipment` refuses tractor/trailer ids rather than dropping them silently.
- Messaging is tenant-scoped to sender plus listed recipients; admins deliberately do not get a blanket read over private threads.

## Native audit artifacts and reproducibility

- Verified the pinned reference HEAD exactly and clean.
- Repaired CoreSimulator/Watchman and created simulator `MF Parity iPhone 16 Pro` (`57C2A199-047B-4250-B159-62A113713DD7`), iOS 26.5, dark mode.
- Reference Expo Go 54 cleared the native confirmation, then remained at 57.1% bundling for about 20 minutes and timed out. MF Expo Go 57 installation was bounded and stopped after 60 seconds, so there is no trustworthy current native MF baseline yet.
- All Metro, Maestro, and installer processes started by the audit were stopped.
- Local artifacts: `/tmp/mf-parity-simulator-home.png`, `/tmp/mf-parity-simulator-ready.png`, `/tmp/appliance-reference-launch.png`, `/tmp/appliance-reference-current.png`, `/tmp/mf-parity-final-runtime-state.png`, and `/tmp/mf-appliance-parity-contact-sheet.png`.

## External blockers requiring Tyler

Supabase staging and production provisioning through the Vercel Marketplace reached the mandatory Vercel terms-acceptance screen. Tyler must accept:

`https://vercel.com/tylerdevries222s-projects/~/integrations/accept-terms/supabase?source=cli`

Then run or resume:

```bash
npx vercel integration add supabase --name mf-superior-products-production --plan free -m region=sfo1 -e production --no-claim --json
npx vercel integration add supabase --name mf-superior-products-staging --plan free -m region=sfo1 -e preview -e development --no-claim --json
```

No Target private EDI companion guides, identifiers, transports, UAT package, or credentials are available. Target must remain labeled `Portal available · EDI onboarding required`. The other six surfaced partners remain `Credentials required` until successful UAT.

The pending-customer migration/auth flow has compile and isolated test coverage but has not run against a real Supabase staging project plus Neon test branch because those services are not provisioned yet.

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

Durable pushed history for this rebuild:

- `f8ec099` — initial freight parity V2 checkpoint
- `d4a887e` — first resumable agent handoff
- `a0e0bfe` — production mobile hydration
- `d361870` — provider-neutral operational demo content
- `b2a3287` — production driver-location action
- `dc0e2f8` — Expo 57 worklets peer
- `6966090` — safe provider-neutral shipment detail response
- `6a18fef` — font/icon asset trimming
- `8d174e0` — pending customer access policy and migration
- `1530fab` — offline queue aligned with the `v1/mutations` contract
- `1d08122` — mobile identity derived from `/api/auth/sync` plus the pending-customer surface
- `2e8d680` — production online mutation and message routes

Continue on `codex/mobile-parity-v2`. After each coherent slice:

```bash
git diff --check
git status --short
git add <verified-files-for-this-slice>
git commit -m "feat: <specific parity slice>"
git push origin codex/mobile-parity-v2
```

Do not rewrite or force-push the branch. Stage explicit paths while another agent is editing the shared worktree, preserve unrelated user changes, and update this handoff after verification results or blockers change.

## Copy/paste start for a Claude cloud agent (Claude desktop app)

Paste this whole block into a new Claude session with the repository connected. It
carries no chat history — everything durable lives in this file and in the pushed
branch, so the agent can resume from a cold start.

```text
Repository: tylerdevries22-afk/mfsuperior-crm
Branch: codex/mobile-parity-v2  (never force-push, never rewrite history)

1. git switch codex/mobile-parity-v2 && git pull --ff-only
2. Read AGENTS.md and HANDOFF_MOBILE_PARITY_V2.md completely before editing anything.
   HANDOFF_MOBILE_PARITY_V2.md is the single source of truth for what is done,
   what is verified, and what is blocked. There is no other context to recover.
3. Keep the appliance reference pinned at 480991b7eb0036e4e85c37d3784b2de2ca97d10d.
   Approved deviations: MF lime branding, freight terminology/data, original
   freight artwork, semantic status colors.
4. Work "Immediate next work, in order" from the first item still marked open.
   Items 1-3 are complete and pushed; start at item 4 unless Tyler says otherwise.
5. Run proportional tests after each coherent change. Zero lint warnings is a
   hard gate, not a goal:
     cd mobile && npm run typecheck && npm run lint && npm test -- --watchman=false --forceExit
     cd ..     && npm run typecheck && npm run lint && npm test
6. Commit each verified slice with explicit paths, then push immediately:
     git diff --check && git status --short
     git add <verified files>
     git commit -m "feat: <specific parity slice>"
     git push origin codex/mobile-parity-v2
7. Update HANDOFF_MOBILE_PARITY_V2.md whenever status, verification results, or
   blockers change, and push that too.
8. Honesty gates, non-negotiable:
   - Do not claim native pixel parity. The canonical geometry conflict
     (393x852 requested vs 402x874 rendered) is unresolved and there is no
     trustworthy current native MF capture.
   - Do not claim any partner connection is live without real credentials and a
     successful UAT. Target stays "Portal available - EDI onboarding required";
     the other six partners stay "Credentials required".
   - Migrations 0008 and 0009 are generated but have never run against a real
     database. Do not report them as applied.
9. Ask Tyler only when an external credential, service approval, production
   authorization, or unresolved product decision is genuinely required.
   The open external blockers are listed under "External blockers requiring Tyler".
```

## Copy/paste start for Claude Code or Kimi

```text
Continue the MF Superior Products parity rebuild in
/Users/tylerdevries/Dev/mfsuperior-crm.

1. Read AGENTS.md and HANDOFF_MOBILE_PARITY_V2.md completely.
2. Stay on codex/mobile-parity-v2; run `git pull --ff-only` and confirm a clean tree.
3. Keep the appliance reference pinned at 480991b7eb0036e4e85c37d3784b2de2ca97d10d.
4. Start with Immediate next work item 1 (offline mutation contract alignment), unless Tyler changes priority.
5. Run proportional tests, stage only verified files, commit each coherent slice, and push immediately. Never force-push.
6. Do not claim native pixel parity: the canonical geometry conflict and missing current native captures remain open.
7. Never claim any partner connection is live without credentials and successful UAT.
```

Fast health check before editing:

```bash
git status --short --branch
git rev-parse HEAD
cd mobile && npm run typecheck && npm run lint && npm test -- --watchman=false --forceExit
cd .. && npm run typecheck && npm run lint && npm test
```
