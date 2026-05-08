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

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${msg}`);
  }
  cached = parsed.data;
  return cached;
}
