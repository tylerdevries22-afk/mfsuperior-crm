import { z } from "zod";

/**
 * Supabase traffic must be encrypted in transit, with one exception: a local
 * development stack (`supabase start`) serves plaintext on loopback or a
 * private LAN address. The exemption is range-based rather than "any http
 * URL", so a public host still fails closed and a misconfigured deployment
 * cannot silently send auth traffic in the clear.
 *
 * This mirrors `isLocalDevelopmentHost` in mobile/lib/auth/config.ts; the two
 * runtimes have no shared module, so the rule is stated in both places.
 */
function isEncryptedOrLocalUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol === "https:") return true;
  if (url.protocol !== "http:") return false;
  return isPrivateNetworkHost(url.hostname);
}

function isPrivateNetworkHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".local")) return true;
  if (host === "::1" || host === "[::1]") return true;
  const octets = host.split(".");
  if (octets.length !== 4) return false;
  const parsed = octets.map((octet) =>
    /^\d{1,3}$/.test(octet) ? Number(octet) : Number.NaN,
  );
  if (parsed.some((octet) => Number.isNaN(octet) || octet > 255)) return false;
  const [first, second] = parsed;
  if (first === 127 || first === 10) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;
  if (first === 169 && second === 254) return true;
  return false;
}

const supabasePublicConfigSchema = z
  .object({
    url: z.url().refine(isEncryptedOrLocalUrl, {
      message: "Supabase URL must use HTTPS outside a local development stack.",
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
