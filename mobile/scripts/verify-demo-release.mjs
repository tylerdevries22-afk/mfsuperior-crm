import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const readJson = (file) => JSON.parse(readFileSync(resolve(projectRoot, file), "utf8"));
const failures = [];

const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const packageJson = readJson("package.json");
const appJson = readJson("app.json").expo;
const easJson = readJson("eas.json");
const projectId = appJson.extra?.eas?.projectId;
const updateUrl = `https://u.expo.dev/${projectId}`;

assert(/^~54\./.test(packageJson.dependencies?.expo ?? ""), "Expo must remain on SDK 54.");
assert(Boolean(projectId), "EAS project ID is missing from app.json.");
assert(appJson.updates?.url === updateUrl, "app.json updates.url must match the EAS project ID.");
assert(appJson.updates?.checkAutomatically === "ON_LOAD", "EAS updates must check on app launch.");
assert(easJson.build?.demo?.channel === "demo", "The demo build must target the demo channel.");
assert(
  easJson.build?.demo?.env?.EXPO_PUBLIC_DEMO_AUTH_ENABLED === "true",
  "The demo build must enable demo authentication at bundle time.",
);

for (const asset of [
  "assets/payouts/apple-cash.png",
  "assets/payouts/cash-app.png",
  "assets/payouts/venmo.png",
  "assets/payouts/zelle.png",
]) {
  const assetPath = resolve(projectRoot, asset);
  assert(existsSync(assetPath) && statSync(assetPath).size > 0, `Missing payout asset: ${asset}`);
}

const loginSource = readFileSync(resolve(projectRoot, "app/(auth)/login.tsx"), "utf8");
const railSource = readFileSync(resolve(projectRoot, "components/operations/PayoutRailLogo.tsx"), "utf8");
assert(loginSource.includes("QuickDemoAccess"), "Quick demo login controls are missing from the login screen.");
assert(loginSource.includes("Autofill ${account.role} demo login"), "Quick demo login controls must expose autofill actions.");
for (const rail of ["apple_cash", "cash_app", "venmo", "zelle"]) {
  assert(railSource.includes(`${rail}: require(`), `Payout rail logo mapping is missing: ${rail}`);
}

if (failures.length > 0) {
  process.stderr.write(`Demo release contract failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("Demo release contract passed.\n");
}
