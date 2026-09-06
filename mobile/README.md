# MF Superior Products Mobile

Expo SDK 57 demo with Customer, Driver, and Admin workspaces. The owner authorized the upgrade from SDK 54 on September 5, 2026. Keep aligned React Native and Expo packages on this SDK until another upgrade is authorized.

## Sharing with clients

Use the public browser deployment for clients without Expo project access. It runs on a hosted HTTPS origin and does not depend on a developer computer, tunnel, shared Wi-Fi network, or a production backend. The release audit records the verified deployment URL.

The native preview uses the `demo` EAS channel and SDK 57 runtime:

```text
exp://u.expo.dev/b28781fa-dd92-41cd-9363-e0860729a811?runtime-version=exposdk%3A57.0.0&channel-name=demo
```

Install a compatible Expo Go version and sign in with an account that owns this EAS project or belongs to its organization. Expo enforces this access rule for EAS updates; a public link cannot grant access to arbitrary Expo accounts. See [Expo's published-project access policy](https://expo.dev/changelog/expo-go-loading-changes-may-2026) and [the SDK 57 iOS login requirement](https://expo.dev/changelog/expo-go-57-login).

The previous SDK 54 update remains available to compatible SDK 54 clients. Native runtime updates require a matching Expo Go version or a new app binary. Close an existing Expo Go session and reopen the link after publishing. For client native installs without Expo account membership, distribute the demo through TestFlight or Google Play testing.

### Demo walkthrough

On the login page, tap **Autofill** for a sample role, then **Sign in**. The credentials are displayed in the app. Demo changes are private to the viewer's device/browser; they do not affect production records. Payment forms accept sample payout handles and move no money. Browser payout handles clear on reload; native handles use device secure storage.

- Customer: review shipments, create a freight request, browse request details and messages.
- Driver: open the next load, complete pickup and intermediate stops, acknowledge delivery, review trip history, set availability and sample payout details.
- Admin: review operations, manage jobs and assignments, inspect the fleet map, manage driver schedules and review settlement information.

Location, camera, clipboard, and external payment-app handoffs depend on device permissions and browser/app support. Denied permissions should show a recoverable error. Map tiles require network access. This is a synthetic operations demo, not a connected dispatch service.

## Local development

```bash
npm ci
EXPO_PUBLIC_DEMO_AUTH_ENABLED=true npm start
```

For a local browser preview use `EXPO_PUBLIC_DEMO_AUTH_ENABLED=true npm run web`. `npm run start:tunnel` is temporary development access and ends when the server stops.

## Verified publishing

```bash
npm run verify:demo
npm run typecheck
npm run lint
npm test
npm run eas:update:demo
npx eas-cli@latest deploy --prod --export-dir dist-demo
```

`eas:update:demo` verifies the SDK/configuration and environment-variable inlining, exports iOS, Android and web with demo auth enabled, checks native bundles/assets and the browser entry, then publishes the same verified export. It uses the authenticated EAS project `@tylerdevries222/mfsuperior-products`.

The GitHub workflow `.github/workflows/mobile-demo-update.yml` runs those gates on `main`, publishes the verified native bundles to the `demo` channel, and deploys the browser app to EAS Hosting. `EXPO_TOKEN` must be configured as a repository secret. The first hosting deployment chooses the project subdomain; future deployments update its stable production alias.

Native demo builds remain available through `npm run eas:build:demo:testflight` and `.github/workflows/mobile-demo-testflight.yml`. They require Apple Developer/TestFlight credentials in EAS.

### Authenticated production access

Production uses Supabase Auth and the public HTTPS Vercel API. Configure these
values in the EAS `production` environment before building or publishing:

```text
EXPO_PUBLIC_MOBILE_PARITY_V2=true
EXPO_PUBLIC_API_BASE_URL=https://mfsuperior-crm.vercel.app/api/mobile
EXPO_PUBLIC_SUPABASE_URL=https://jyzgipvopoldpdcrbkvx.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

Then create the iPhone binary once and publish OTA updates afterward:

```bash
npm run eas:build:production
npm run eas:update:production
```

Native changes, new Expo modules, permissions, and runtime changes require a
new EAS build. JavaScript, styling, and compatible assets can use EAS Update.

Expo Go cannot automatically follow a configured EAS channel like a release
binary. For a hosted Expo Go preview, use the client link above or generate a
new one from `qr.expo.dev`; for a durable store-style install, use the EAS
demo/production build on the iPhone instead.

## Production configuration

The production cutover fails closed until all public values are present and the internal gate is enabled:

```bash
EXPO_PUBLIC_MOBILE_PARITY_V2=true
EXPO_PUBLIC_API_BASE_URL=https://your-app.example/api/mobile
EXPO_PUBLIC_SUPABASE_URL=https://jyzgipvopoldpdcrbkvx.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

The mobile client never receives a Supabase service-role key. Set `EXPO_PUBLIC_DEMO_AUTH_ENABLED=true` only in an explicitly labeled demo build.

## Supabase migration workflow

The fleet thumbnail, transfer-event, and push-token schema lives in
`supabase/migrations/20260827215437_vehicle_thumbnails_transfers_notifications.sql`.
Run these commands from the repository root, not from `mobile/`. Use Docker to
validate it locally, then promote the same migration after the hosted project
is unpaused:

```bash
npm run supabase:local:up
npm run supabase:local:migrate
supabase link --project-ref jyzgipvopoldpdcrbkvx
# Set DATABASE_URL to the hosted project's migration-capable Postgres URL.
npm run db:migrate
npm run supabase:cloud:migrate
```

The server must still have `DATABASE_URL`, `SUPABASE_URL`, and
`SUPABASE_SERVICE_ROLE_KEY` configured for the same hosted project. `db:migrate`
applies the existing application schema; `supabase:cloud:migrate` adds the
Supabase Storage bucket, Realtime event table, RLS, and push-token table. The
mobile client only uses the publishable key.

## Explicit demo accounts

| Workspace | Email | PIN |
|---|---|---|
| Customer | `customer@demo.mfsuperior.com` | `1111` |
| Driver (Brenna Lewis) | `driver@demo.mfsuperior.com` | `2222` |
| Admin | `admin@demo.mfsuperior.com` | `3333` |

The Admin demo profile can preview all three workspaces without changing the signed-in account.

## Verification

```bash
npm run typecheck
npm run lint -- --max-warnings=0
npm test -- --runInBand
npm run build
npx expo-doctor
```

Demo records are local synthetic data. Target remains portal-available with EDI onboarding required; no production transport or credentials are configured. The app does not provide ELD compliance.
