# MF Superior Products Mobile

Expo SDK 54 app for the Customer, Driver, and Admin workspaces. The visual parity baseline is the Appliance Diagnostic mobile app at commit `480991b7eb0036e4e85c37d3784b2de2ca97d10d` with MF lime branding and freight-specific content and artwork.

## Local development

```bash
npm install
npx expo start
```

Open the QR code in Expo Go, or press `i` for an iOS Simulator.

The local Expo Go workflow is development-only. It depends on a running
development server and is not a public deployment.

### Hosted Expo Go preview (SDK 54, best effort)

The demo update is published to EAS and can be opened directly from Expo Go
without running this project locally. The viewer must be signed in to an Expo
account that owns the project or belongs to its Expo organization. Send the
authorized viewer this link:

```text
exp://u.expo.dev/b28781fa-dd92-41cd-9363-e0860729a811?runtime-version=exposdk%3A54.0.0&channel-name=demo
```

The viewer installs the SDK 54 Expo Go app, signs in to an authorized Expo
account, and taps the link on the iPhone. The link uses the `demo` channel, so
publish future JavaScript and styling changes with `npm run eas:update:demo`
and keep the runtime version compatible. Demo records remain on the viewer's
device. Expo Go on iOS is a preview sandbox; it does not reliably follow an
EAS channel or install runtime-version updates like a release build.
The published update uses the SDK 54 runtime `exposdk:54.0.0`.

### Share an Expo Go preview

To let someone outside your local network open the current local build:

```bash
npm run start:tunnel
```

Copy the `exp://` URL or share the terminal QR code. The recipient needs Expo
Go installed and the tunnel must remain running; closing the terminal ends the
preview. For a reliable client install that works without your computer, use
the EAS demo build through TestFlight instead.

## Cloud deployment and OTA updates

The app is linked to the EAS project
`@tylerdevries222/mfsuperior-products`. EAS Update publishes JavaScript,
styling, and bundled assets to the cloud. The compatible app binary must be
installed once before it can receive OTA updates.

### Public demo access

The demo profile is self-contained and does not call this repository, a local
server, or Supabase. Build it once, distribute that build through TestFlight,
and publish future demo changes with:

```bash
npm run eas:build:demo:testflight
npm run eas:update:demo
```

Demo records stay on each device. The demo channel is intended for showing the
product, not for shared operations data or real authentication.

The first iOS build requires Apple Developer/TestFlight credentials in EAS.
After the binary is installed, `eas:update:demo` publishes compatible changes
over the air without requiring the Mac or a running development server.

### Automatic demo publishing

The GitHub Actions workflow at `.github/workflows/mobile-demo-update.yml`
validates the mobile project and publishes the `demo` channel after every
mobile change merged to `main`. Add an `EXPO_TOKEN` repository secret once;
the workflow fails clearly if that secret is missing instead of silently
leaving the phone on an old update. This does not hot-reload an already-open
Expo Go session: close that session and reopen the hosted link to load the
newest published update.

To create the reliable client install without running anything locally, run
the `Build Mobile Demo for TestFlight` workflow from GitHub Actions (or run
`gh workflow run mobile-demo-testflight.yml`). It builds and submits the
SDK 54 demo through EAS using the `demo` channel. After the first TestFlight
install, future JavaScript, styling, and bundled-asset changes are delivered
by the automatic `main` publish workflow.

### Authenticated production access

Production uses Supabase Auth and the public HTTPS Vercel API. Configure these
values in the EAS `production` environment before building or publishing:

```text
EXPO_PUBLIC_MOBILE_PARITY_V2=true
EXPO_PUBLIC_API_BASE_URL=https://mfsuperior-crm.vercel.app/api/mobile
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
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
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

The mobile client never receives a Supabase service-role key. Set `EXPO_PUBLIC_DEMO_AUTH_ENABLED=true` only in an explicitly labeled demo build.

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
