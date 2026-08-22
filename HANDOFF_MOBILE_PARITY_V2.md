# MF Superior Products Mobile Parity V2 — Agent Handoff

Last updated: 2026-08-21  
Working branch: `codex/mobile-parity-v2`  
First durable checkpoint: `f8ec099`  
Latest feature checkpoint at this update: `e042222`
Remote: `origin` (`tylerdevries22-afk/mfsuperior-crm`)

## Objective and immutable baseline

Rebuild `mobile/` to match the Appliance Diagnostic Expo app screen-for-screen while tailoring content and artwork to freight operations. The visual source of truth is:

- Repository: `/Users/tylerdevries/Dev/appliance-diagnostic-systems`
- Mobile source: `/Users/tylerdevries/Dev/appliance-diagnostic-systems/artifacts/mobile`
- Pinned commit: `480991b7eb0036e4e85c37d3784b2de2ca97d10d`
- Requested canonical device: iPhone 16 Pro, 393×852 logical pixels, iOS 26, dark appearance, default text size, Expo Go

The reference app is Expo SDK 54.0.37 / React Native 0.81.5. The MF app now
matches that, which is a prerequisite for both device testing and any honest
pixel comparison.

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
- Made the operational tenant boundary structural instead of application-only in additive migration `0010_tenant_backfill_constraints.sql`. `carriers.organization_id` and `shipments.carrier_id` are now non-null, `shipments` carries an `organization_id` tenant pin, and composite foreign keys make it impossible for a shipment to name another tenant's carrier, for a shipment to name another carrier's driver, or for `customer_shipment_access` / `freight_documents` / `shipment_external_references` to name a shipment outside their own organization. The backfill gives an orphan carrier its own **suspended** organization so the row survives without granting anyone access, and refuses to guess a tenant for a carrier-less shipment.
- **Aligned the mobile app to Expo SDK 54 / React Native 0.81.5, matching the pinned reference exactly.** Expo Go on the App Store is capped at SDK 54 (Expo submitted SDK 55 on 2026-05-04; Apple has not approved it), so SDK 55/56/57 cannot be opened by any App Store Expo Go on a physical device. The reference app at `480991b` is itself Expo 54.0.37 / RN 0.81.5, so the previous SDK 57 / RN 0.86.2 setup was both a device blocker and a parity confound — RN 0.81 and 0.86 differ in text layout and flexbox metrics. Two API migrations were required: expo-router 6 exports `Icon`/`Label` as elements rather than `NativeTabs.Trigger` statics and uses `drawable` instead of `md`, and `StyleSheet.absoluteFill` is not spreadable in RN 0.81 (`absoluteFillObject` is).
- Closed a **critical** authentication oracle in `checkCronAuth`: the 401 body returned `common_prefix_length` and `expected_token_length`, which together let an unauthenticated caller recover the 32-character `CRON_SECRET` in roughly 512 requests. That secret gates the cron routes that send email to leads. Diagnostics are now one-sided and withheld in production, and the compare is constant-time.
- Hardened the public `POST /api/contact`: it is unauthenticated and CORS-open by design but accepted unbounded fields, did not validate the address it then emailed, and had no rate limit. Fields are now strictly parsed and length-bounded, and the route is limited per client address and per submitted email.
- Made the Resend webhook signature comparison constant-time.
- Collapsed `.` and `..` upload file names to a literal object key. Path separators were already stripped, so this closes the remaining ambiguity rather than a traversal.
- Created the `notifications` table in additive migration `0011_notifications_repair.sql`. It had been declared in `schema.ts` and present in the drizzle snapshot since `0004`, but no migration ever emitted the DDL, so every freshly migrated database was missing it.
- Unified the "is this host reachable without TLS" rule. Three separate copies disagreed: auth config accepted only loopback, `ApiClient` had its own loopback-only copy, and the server required HTTPS outright. A physical device reaches the dev machine by LAN address, so the app passed configuration validation and then crashed inside the API client. One shared `mobile/lib/private-network.ts` now backs both mobile call sites, and the server mirrors it; loopback, RFC1918, link-local, and `.local` are allowed over plaintext and public hosts still fail closed.
- **Rebuilt the schedule on the reference components.** `mobile/route-support/schedule/` now mirrors the reference module at `route-support/(tabs)/schedule/`: `styles.ts` and `SegmentBar` are ported verbatim (only the token import differs), and `JobCard`, `DayTimeline`, `TechnicianFilter`, `useScheduleData`, and `useScheduleFilters` are ported with jobs mapped to loads and technicians to drivers. The screen is the reference composition — week strip, driver chips, list/day toggle, day-grouped cards, swipeable day timeline with now-line, calendar-view modal, floating Today button.
- Added real driver avatars. The reference's `TechAvatar` renders a portrait and falls back to initials only when none exists; `DriverAvatar` resolves an API `avatarUrl`, then a bundled portrait, then initials. It is shared, so the schedule, the home driver strip, and the customer glance card all use it — the home strip previously keyed off `index === 0`, giving the first driver a generic stock image and everyone else initials. Portraits live in `mobile/assets/avatars/`, and per-type equipment artwork in `mobile/assets/freight/equipment-*.webp`.
- Added `scripts/seed-mf-superior.ts` (`npm run tenant:seed`): an idempotent seed for the MF Superior Products organization, its carrier profile, and the initial `info@mfsuperiorproducts.com` admin invitation. It mints an invitation rather than a membership, so admins stay invitation-only, prints the raw token exactly once because only the SHA-256 hash is stored, and refuses to rewrite an existing SCAC or reactivate a non-active organization.

## Local Docker stack (running, verified end to end)

A local Supabase stack now runs in Docker for this repository (`supabase start`,
`supabase/config.toml`, ports shifted to 55321-55324 so they do not collide with
the appliance reference stack). This removed the standing "no database" blocker
for local work:

- **Migrations 0000-0011 have now been applied to a real Postgres database.** They
  are no longer generated-but-unrun. `drizzle-kit generate` reports no drift and
  all 45 declared tables exist.
- Migration `0010`'s tenant boundary was verified adversarially against the live
  database: a shipment naming another tenant's carrier is rejected, a shipment
  naming another carrier's driver is rejected, and a same-tenant shipment is
  accepted.
- `npm run tenant:seed` has now been executed. It created the MF Superior
  organization, its carrier, and the first admin invitation, and re-running it is
  idempotent. **The SCAC used locally is the placeholder `MFSP`; the real
  NMFTA-assigned code is still required before production.**
- The full identity chain works: a Supabase user signs in, `POST /api/auth/sync`
  redeems the admin invitation and creates the membership, and
  `/api/mobile/v1/bootstrap|shipments|requests|exceptions|messages` all return
  200 with the `{ data, error, meta }` envelope.
- The mobile app was loaded on the iPhone 16 Pro simulator through Expo Go 57.0.9
  against this stack and renders the login screen. Expo Go 57 is now installed on
  the simulator, which the previous audit had left unfinished.

Local-only credentials live in the gitignored `.env.local` and `mobile/.env.local`.
The Supabase keys there are the CLI's well-known local defaults, not secrets.

Bringing the stack up from cold:

```bash
supabase start                                    # Postgres + auth + storage in Docker
npm run db:migrate                                # applies 0000-0011
MF_SUPERIOR_SCAC=<scac> npm run tenant:seed       # prints the admin token once
npx next dev -H 0.0.0.0 -p 3100                   # backend, reachable on the LAN
cd mobile && npx expo start --lan                 # Metro for Expo Go
```

`mobile/.env.local` and the backend `APP_URL`/`MOBILE_ALLOWED_ORIGINS` contain
this machine's LAN address. **A different machine or network needs those
rewritten** — a phone cannot reach `localhost`.

Expo Go must be the SDK 54 build (`54.0.7`). The simulator copy lives at
`~/.expo/ios-simulator-app-cache/Expo-Go-54.0.7.tar.app` and can be installed
with `xcrun simctl install <udid> <path>`; `npx expo start --ios` prompts for it
but needs an interactive terminal.

## Running the app without shared Wi-Fi

A phone that cannot join this machine's network reaches Metro through an Expo
tunnel: `npx expo start --tunnel` publishes `exp://<slug>.exp.direct`, which
works over cellular.

The tunnel only carries Metro. The backend and Supabase stay on localhost, so
the app is run in **demo mode** for that scenario:
`EXPO_PUBLIC_DEMO_AUTH_ENABLED=true` in `mobile/.env.local` selects
`DemoOperationsRepository`, which holds all state on-device in AsyncStorage and
needs no backend and no Supabase. `resolveAuthRuntimeConfig` checks the demo
flag first, so the production variables can stay in the file, inert.

Verified end to end: the manifest and the full 9.3 MB bundle both download over
the public tunnel host, and the app renders the demo workspace on the simulator
when opened at the tunnel URL.

Demo mode is a UI-complete path, **not** the production path. Exercising the
real backend from a phone off this network requires deploying the backend and
Supabase to public HTTPS origins and pointing `EXPO_PUBLIC_API_BASE_URL` and
`EXPO_PUBLIC_SUPABASE_URL` at them. Exposing the local Supabase through a public
tunnel is not an acceptable substitute — it would put an auth service and its
service-role surface on the open internet.

Note on `simctl`: `xcrun simctl openurl` only lands reliably when Expo Go is
**not** already running. Launching Expo Go and then opening the URL races, and
the app silently stays on the Expo Go home screen. Terminate first, then
`openurl` cold.

## Verification already passing (re-run at this checkpoint)

Re-run and green at this checkpoint:

- Mobile TypeScript: `cd mobile && npm run typecheck` — clean
- Mobile ESLint: `cd mobile && npm run lint` — zero warnings
- Complete mobile Jest suite: 18 suites, 96/96 assertions
- Backend TypeScript: `npx tsc --noEmit --incremental false` — clean
- Web ESLint: `npm run lint` — zero warnings
- Complete web Vitest suite: 123 passed, 14 skipped (15 files, 2 skipped)
- Backend mobile-API contract tests (`tests/unit/carrier-api.test.ts`): 20/20
- Cron authentication regression tests (`tests/unit/cron-auth.test.ts`): 4/4
- Tenant provisioning and boundary tests (`tests/unit/tenant-provisioning.test.ts`): 15/15, covering the invitation token/TTL contract, the Drizzle-level tenant constraints, and migration `0010`'s backfill and constraint ordering
- `drizzle-kit generate` reports no drift between `src/lib/db/*schema.ts` and the `0010` snapshot
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

Items 1 through 4 are complete and pushed. The remaining order is:

1. **(Done)** Offline queue aligned with `v1/mutations`.
2. **(Done)** `/api/auth/sync` is the mobile identity source of truth and `pending_customer_approval` renders.
3. **(Done)** Production online mutation/message routes implemented; the only writes that still refuse are the two with no server-side model (intermediate stops, tractor/trailer assignment), and they now fail closed with structured errors instead of hitting missing URLs.
4. **(Done, unapplied)** Tenant backfill/validation constraints landed as migration `0010_tenant_backfill_constraints.sql`, and `npm run tenant:seed` provisions the MF Superior organization, its carrier, and the first admin invitation. Migrations `0008`, `0009`, and `0010` are generated but have **not been applied to any database**, and the seed has **never been executed**, because no Neon/Supabase project is provisioned yet. The seed additionally needs the real `MF_SUPERIOR_SCAC` from Tyler.
5. Resolve the canonical simulator geometry, then capture both apps natively and close measured typography/spacing/component diffs. The simulator still reports 402x874, so the conflict is unresolved; the SDK/RN alignment removes the version-skew confound but does not settle the device geometry question. The current MF login sheet and monolithic role-home composition are source-inspection parity risks. Web screenshots are not a release substitute.
6. Add Maestro journeys, screenshot masks/threshold checks, accessibility automation, Playwright staging coverage, mutation testing, health checks, and CI gates from the approved plan.
7. Run the complete final suite after pending backend edits: mobile lint/typecheck/Jest/Expo Doctor/export, web lint/typecheck/Vitest/build/Playwright, audits, secret scan, bundle and asset budgets.

### Known limitations recorded honestly

- `shipment_events` records `driver_id` but not a general actor user id, so an admin-reported exception has no reporter attribution. The mobile `ExceptionReport.reportedByAccountId` is the driver id when present and an empty string otherwise.
- `shipments.intermediate_stops` exists as JSONB but nothing writes it and the mobile projection only builds a pickup and a delivery stop, so `advanceIntermediateStop` fails closed rather than pretending.
- There is no server-side equipment registry, so `assignShipment` refuses tractor/trailer ids rather than dropping them silently.
- The schedule departs from the reference in three functional places, each commented at the site: the week strip derives its scroll pitch from the real cell geometry (44 + 2 gap) rather than the reference's hard-coded 52, which drifts ~6pt per cell; day blocks are clamped to the 6am-10pm grid because freight runs outside those hours and an unclamped block carries its label out of view; and driver colours are hashed from the driver id because freight drivers carry no provider-assigned colour field.
- The demo fixtures use fixed 2026-08-18/20/21 dates, so as real time moves on the schedule will increasingly show only past loads. Making the demo data relative to "now" is not done.
- Messaging is tenant-scoped to sender plus listed recipients; admins deliberately do not get a blanket read over private threads.
- `shipment_events`, `driver_locations`, and `driver_status_events` inherit tenancy transitively through non-null foreign keys to `shipments` and `drivers`, which are themselves tenant-pinned by migration `0010`. They carry no tenant column of their own, so a telemetry row naming a driver from one carrier and a shipment from another is still blocked only by the application check, not by a database constraint. Closing that would require either a denormalized `carrier_id` on each table or a trigger; neither is in place.
- Migration `0010` gives an orphan carrier a **suspended** organization rather than an active one. That is deliberate — no one gains access from a backfill — but an operator must consciously activate such an organization before its carrier is usable.
- The mobile dependency audit reports 19 advisories (10 moderate, 9 high) at SDK 54, all transitive inside Expo's own build tooling (`image-size` via metro, `uuid` via xcode/config-plugins, `postcss`). These are dev-time tooling, not code shipped to the device. `npm audit fix --force` must not be used: it would break the SDK 54 pinning that device access depends on.
- `scripts/seed-mf-superior.ts` requires `MF_SUPERIOR_SCAC` and has no default. A placeholder SCAC would end up in EDI envelopes, so the script fails closed instead.

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

Tyler must also supply the real NMFTA-assigned Standard Carrier Alpha Code for MF Superior Products as `MF_SUPERIOR_SCAC` before `npm run tenant:seed` can run. The script deliberately has no default because the SCAC is stamped into EDI envelopes.

Once the database exists, the first-tenant sequence is:

```bash
npm run db:migrate                                  # applies 0008, 0009, and 0010
MF_SUPERIOR_SCAC=<real-scac> npm run tenant:seed    # prints the admin token once
```

The seed prints the raw invitation token exactly once, because only its SHA-256 hash is stored. Deliver it to `info@mfsuperiorproducts.com` over a channel they control; they redeem it by signing in and calling `POST /api/auth/sync` with `{ "invitationToken": "<token>" }`.

## Production environment contract

Mobile public configuration:

```bash
EXPO_PUBLIC_MOBILE_PARITY_V2=true
EXPO_PUBLIC_API_BASE_URL=https://YOUR_APP/api/mobile
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Server configuration additionally needs Supabase server/storage credentials, `MOBILE_ALLOWED_ORIGINS`, Resend SMTP settings, encryption key/version settings, Neon `DATABASE_URL`, and the private storage bucket. Never put a Supabase service-role key in Expo public variables.

Tenant configuration:

- `CUSTOMER_SELF_REGISTRATION_ORGANIZATION_SLUG` — optional; defaults to `mf-superior`, which is the slug `npm run tenant:seed` creates. Overriding it without seeding the matching organization strands every self-registered customer.
- `MF_SUPERIOR_SCAC` — seed-script only, required, no default. Not read at runtime.

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
- `7c1a0d6` — operational tenant constraints and first-organization seed

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
   Items 1-4 are complete and pushed; start at item 5 unless Tyler says otherwise.
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
   - Migrations 0008, 0009, and 0010 are generated but have never run against
     a real database, and `npm run tenant:seed` has never been executed. Do not
     report them as applied, and do not report the MF Superior organization,
     its carrier, or the info@mfsuperiorproducts.com admin invitation as
     existing anywhere.
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
4. Start with Immediate next work item 5 (canonical simulator geometry), unless Tyler changes priority. Items 1-4 are complete and pushed.
5. Run proportional tests, stage only verified files, commit each coherent slice, and push immediately. Never force-push.
6. Do not claim native pixel parity: the canonical geometry conflict and missing current native captures remain open.
7. Never claim any partner connection is live without credentials and successful UAT.
8. Migrations 0008/0009/0010 and `npm run tenant:seed` have never touched a real database. Do not report them as applied.
```

Fast health check before editing:

```bash
git status --short --branch
git rev-parse HEAD
cd mobile && npm run typecheck && npm run lint && npm test -- --watchman=false --forceExit
cd .. && npm run typecheck && npm run lint && npm test
```
