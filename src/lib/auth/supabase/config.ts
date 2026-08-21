import { z } from "zod";

const supabasePublicConfigSchema = z
  .object({
    url: z.url().refine((value) => value.startsWith("https://"), {
      message: "Supabase URL must use HTTPS.",
    }),
    publishableKey: z.string().trim().min(20).max(4_096),
  })
  .strict();

export type SupabasePublicConfig = z.infer<typeof supabasePublicConfigSchema>;

/**
 * Reads configuration lazily so `next build` never requires live Supabase
 * credentials. A missing or malformed pair fails closed at request time.
 */
export function readSupabasePublicConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): SupabasePublicConfig | null {
  const candidate = {
    url: environment.NEXT_PUBLIC_SUPABASE_URL ?? environment.SUPABASE_URL,
    publishableKey:
      environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      environment.SUPABASE_PUBLISHABLE_KEY,
  };
  const parsed = supabasePublicConfigSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}
