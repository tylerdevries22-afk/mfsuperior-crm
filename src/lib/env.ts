import { z } from "zod";

const blankAsUndefined = (value: unknown): unknown =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const environmentSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),
  APP_URL: z.string().url(),
  CRON_SECRET: z.string().min(16),
  ENCRYPTION_KEY: z.string().min(32),

  RESEND_API_KEY: z.preprocess(blankAsUndefined, z.string().min(1).optional()),
  RESEND_WEBHOOK_SECRET: z.preprocess(blankAsUndefined, z.string().min(1).optional()),

  GMAIL_USER: z.preprocess(blankAsUndefined, z.string().email().optional()),
  DRIVE_FOLDER_ID: z.preprocess(blankAsUndefined, z.string().optional()),

  // Paid lead-research mode (admin "Run paid research" button + CLI
  // `--mode paid`). Free mode needs neither — discovery via OSM, email
  // verification via node:dns MX lookups.
  GOOGLE_MAPS_API_KEY: z.preprocess(blankAsUndefined, z.string().min(1).optional()),
  HUNTER_API_KEY: z.preprocess(blankAsUndefined, z.string().min(1).optional()),

  BUSINESS_NAME: z.string().min(1),
  BUSINESS_ADDRESS: z.string().min(1),
  BUSINESS_MC: z.preprocess(blankAsUndefined, z.string().optional()),
  BUSINESS_USDOT: z.preprocess(blankAsUndefined, z.string().optional()),

  DAILY_SEND_CAP: z.preprocess(
    blankAsUndefined,
    z.coerce.number().int().positive().default(20),
  ),
  WARMUP_DAYS: z.preprocess(
    blankAsUndefined,
    z.coerce.number().int().min(0).default(7),
  ),
  WARMUP_DAILY_CAP: z.preprocess(
    blankAsUndefined,
    z.coerce.number().int().positive().default(5),
  ),

  CARRIER_DEMO_MODE: z.preprocess(
    blankAsUndefined,
    z.enum(["true", "false"]).optional(),
  ),
  WEB_ADMIN_ORGANIZATION_SLUG: z.preprocess(
    blankAsUndefined,
    z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/).optional(),
  ),
  CUSTOMER_SELF_REGISTRATION_ORGANIZATION_SLUG: z.preprocess(
    blankAsUndefined,
    z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/).optional(),
  ),

  SUPABASE_URL: z.preprocess(blankAsUndefined, z.string().url().optional()),
  NEXT_PUBLIC_SUPABASE_URL: z.preprocess(blankAsUndefined, z.string().url().optional()),
  SUPABASE_PUBLISHABLE_KEY: z.preprocess(blankAsUndefined, z.string().min(20).optional()),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.preprocess(
    blankAsUndefined,
    z.string().min(20).optional(),
  ),
  SUPABASE_SERVICE_ROLE_KEY: z.preprocess(
    blankAsUndefined,
    z.string().min(20).optional(),
  ),
  SUPABASE_STORAGE_BUCKET: z.preprocess(blankAsUndefined, z.string().min(1).optional()),
  MOBILE_ALLOWED_ORIGINS: z.preprocess(blankAsUndefined, z.string().optional()),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof environmentSchema>;

let cached: Env | undefined;

// During `next build` Next imports every route module to collect page data.
// On Vercel the build environment frequently lacks the runtime secrets that
// only get injected into serverless functions, so a hard schema throw at
// import time aborts the deployment. Detect the build phase (or an explicit
// SKIP_ENV_VALIDATION flag) and fall back to an unvalidated view of
// process.env — runtime callers still get full validation.
function shouldSkipValidation(): boolean {
  return (
    process.env.SKIP_ENV_VALIDATION === "1" ||
    process.env.NEXT_PHASE === "phase-production-build"
  );
}

export function env(): Env {
  if (cached) return cached;
  if (shouldSkipValidation()) {
    return process.env as unknown as Env;
  }
  const parsed = environmentSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${msg}`);
  }
  cached = parsed.data;
  return cached;
}
