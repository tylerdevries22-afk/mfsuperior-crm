import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),
  APP_URL: z.string().url(),
  CRON_SECRET: z.string().min(16),
  ENCRYPTION_KEY: z.string().min(32),

  RESEND_API_KEY: z.string().min(1).optional(),

  GMAIL_USER: z.string().email().optional(),
  DRIVE_FOLDER_ID: z.string().optional(),

  BUSINESS_NAME: z.string().min(1),
  BUSINESS_ADDRESS: z.string().min(1),
  BUSINESS_MC: z.string().optional(),
  BUSINESS_USDOT: z.string().optional(),

  DAILY_SEND_CAP: z.coerce.number().int().positive().default(20),
  WARMUP_DAYS: z.coerce.number().int().min(0).default(7),
  WARMUP_DAILY_CAP: z.coerce.number().int().positive().default(5),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

// Skip strict validation when:
// - Next.js is building (no runtime env yet on Vercel) — `NEXT_PHASE=phase-production-build`
// - the operator explicitly opts out via `SKIP_ENV_VALIDATION=1`
// In skip mode, missing vars are returned as undefined; values that *are* set still
// have to match their schema. Code paths that need a missing value will fail when
// they actually access it at runtime, not at build / module-load time.
function shouldSkipValidation(): boolean {
  return (
    process.env.SKIP_ENV_VALIDATION === "1" ||
    process.env.NEXT_PHASE === "phase-production-build"
  );
}

export function env(): Env {
  if (cached) return cached;
  const strict = schema.safeParse(process.env);
  if (strict.success) {
    cached = strict.data;
    return cached;
  }
  if (shouldSkipValidation()) {
    // Partial schema lets every required field be undefined while still
    // applying defaults for the optional/coerced fields.
    const lenient = schema.partial().safeParse(process.env);
    cached = (lenient.success ? lenient.data : {}) as Env;
    return cached;
  }
  const msg = strict.error.issues
    .map((i) => `  ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid environment variables:\n${msg}`);
}
