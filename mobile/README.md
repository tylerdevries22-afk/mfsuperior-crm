# MF Superior Products Mobile

Expo SDK 57 app for the Customer, Driver, and Admin workspaces. The visual parity baseline is the Appliance Diagnostic mobile app at commit `480991b7eb0036e4e85c37d3784b2de2ca97d10d` with MF lime branding and freight-specific content and artwork.

## Run

```bash
npm install
npx expo start
```

Open the QR code in Expo Go, or press `i` for an iOS Simulator.

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
