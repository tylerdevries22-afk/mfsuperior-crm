# MF Superior Operations Demo

Expo SDK 57 prototype for the Customer, Driver, and Dispatcher workspaces. It uses the Appliance Diagnostic app's compact native layout system with MF Superior's lime-and-neutral brand palette.

## Run

```bash
npm install
npx expo start
```

Open the QR code in Expo Go, or press `i` for an iOS Simulator.

## Demo accounts

| Workspace | Email | PIN |
|---|---|---|
| Customer | `customer@demo.mfsuperior.com` | `1111` |
| Driver (Brenna Lewis) | `driver@demo.mfsuperior.com` | `2222` |
| Dispatcher | `dispatcher@demo.mfsuperior.com` | `3333` |

The Dispatcher profile can preview all three workspaces without changing the signed-in account.

## Verification

```bash
npm run typecheck
npm run lint -- --max-warnings=0
npm test -- --runInBand
npm run build
npx expo-doctor
```

All Target IDs, EDI documents, GPS updates, messages, signatures, and photos are local prototype records. The app has no live Target connection and does not provide ELD compliance.
