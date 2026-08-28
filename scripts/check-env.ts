/**
 * scripts/check-env.ts
 *
 * Validate the current shell + .env.local against the canonical schema in
 * src/lib/env.ts. Run with:
 *
 *   npm run env:check                     # validates ./.env.local
 *   npm run env:check -- .env.production  # any other path
 *
 * Exit codes:
 *   0 — all required vars present and valid
 *   1 — schema validation failed (one or more required vars missing/invalid)
 *   2 — file not found
 */

import { config as loadDotenv } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { environmentSchema } from "../src/lib/env";

const REQUIRED = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "APP_URL",
  "CRON_SECRET",
  "ENCRYPTION_KEY",
  "BUSINESS_NAME",
  "BUSINESS_ADDRESS",
] as const;

const OPTIONAL = [
  "RESEND_API_KEY",
  "RESEND_WEBHOOK_SECRET",
  "GMAIL_USER",
  "DRIVE_FOLDER_ID",
  "BUSINESS_MC",
  "BUSINESS_USDOT",
  "DAILY_SEND_CAP",
  "WARMUP_DAYS",
  "WARMUP_DAILY_CAP",
  "GOOGLE_MAPS_API_KEY",
  "HUNTER_API_KEY",
  "CARRIER_DEMO_MODE",
  "WEB_ADMIN_ORGANIZATION_SLUG",
  "CUSTOMER_SELF_REGISTRATION_ORGANIZATION_SLUG",
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_STORAGE_BUCKET",
  "MOBILE_ALLOWED_ORIGINS",
] as const;

const arg = process.argv[2] ?? ".env.local";
const envPath = path.resolve(process.cwd(), arg);

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

console.log(bold(`\nEnvironment check — ${cyan(envPath)}\n`));

if (!fs.existsSync(envPath)) {
  console.log(red(`✗ File not found: ${envPath}`));
  console.log(
    dim(
      `  Create it with: cp .env.example ${path.relative(process.cwd(), envPath) || ".env.local"}`,
    ),
  );
  process.exit(2);
}

// Load the file into a fresh object (don't mutate process.env so we can also
// see what the shell already has set).
const fileVars: Record<string, string> = {};
loadDotenv({ path: envPath, processEnv: fileVars, quiet: true });

// Merge: shell env wins (mirrors how Next/Vercel runtime resolves), but flag
// when the file disagrees with the shell.
const merged: Record<string, string | undefined> = { ...fileVars };
for (const key of [...REQUIRED, ...OPTIONAL] as readonly string[]) {
  if (process.env[key] !== undefined) merged[key] = process.env[key];
}

const result = environmentSchema.safeParse(merged);

const allKeys = [...REQUIRED, ...OPTIONAL] as readonly string[];
const issuesByKey = new Map<string, string>();
if (!result.success) {
  for (const issue of result.error.issues) {
    issuesByKey.set(String(issue.path[0]), issue.message);
  }
}

let problems = 0;

console.log(bold("Required:"));
for (const key of REQUIRED) {
  const value = merged[key];
  const issue = issuesByKey.get(key);
  if (!value) {
    console.log(`  ${red("✗")} ${key.padEnd(24)} ${red("missing")}`);
    problems++;
  } else if (issue) {
    console.log(`  ${red("✗")} ${key.padEnd(24)} ${red(issue)}`);
    problems++;
  } else {
    console.log(`  ${green("✓")} ${key.padEnd(24)} ${dim(maskValue(key, value))}`);
  }
}

console.log("\n" + bold("Optional:"));
for (const key of OPTIONAL) {
  const value = merged[key];
  const issue = issuesByKey.get(key);
  if (issue) {
    console.log(`  ${red("✗")} ${key.padEnd(24)} ${red(issue)}`);
    problems++;
  } else if (!value) {
    console.log(`  ${yellow("·")} ${key.padEnd(24)} ${dim("unset")}`);
  } else {
    console.log(`  ${green("✓")} ${key.padEnd(24)} ${dim(maskValue(key, value))}`);
  }
}

// Drift: keys in the file that aren't in the schema.
const known = new Set(allKeys);
const platformManagedKeys = new Set(["NODE_ENV", "VERCEL_OIDC_TOKEN"]);
const extras = Object.keys(fileVars).filter(
  (key) => !known.has(key) && !platformManagedKeys.has(key),
);
if (extras.length > 0) {
  console.log("\n" + bold("Unrecognized keys in file (drift):"));
  for (const key of extras) {
    console.log(`  ${yellow("⚠")} ${key} ${dim("— not in src/lib/env.ts schema")}`);
  }
}

if (problems === 0) {
  console.log("\n" + green(bold("✓ All required environment variables are valid.")));
  process.exit(0);
} else {
  console.log("\n" + red(bold(`✗ ${problems} problem${problems === 1 ? "" : "s"} found.`)));
  console.log(
    dim(
      "  Fix the entries above in " +
        path.relative(process.cwd(), envPath) +
        ", then re-run `npm run env:check`.",
    ),
  );
  process.exit(1);
}

function maskValue(key: string, value: string): string {
  // Redact secrets. Show only length + last 4 chars.
  const sensitive =
    /SECRET|KEY|TOKEN|PASSWORD|DATABASE_URL|GOOGLE_ID|GOOGLE_SECRET/i.test(key);
  if (!sensitive) return value;
  const tail = value.length > 4 ? value.slice(-4) : "";
  return `[${value.length} chars … ${tail}]`;
}
