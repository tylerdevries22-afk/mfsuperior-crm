import { type EmailProvider } from "./provider";
import { ResendProvider } from "./resend-provider";
import { GmailProvider } from "@/lib/gmail/provider";
import { env } from "@/lib/env";

/**
 * Returns the active email provider.
 *
 * Priority:
 *   1. Resend — when RESEND_API_KEY is set.
 *   2. Gmail — falls back for userId; requires a stored OAuth token.
 *
 * The `userId` is only needed for the Gmail path (per-user OAuth tokens).
 * Resend uses a single API key scoped to the account.
 */
export function getEmailProvider(userId: string): EmailProvider {
  const { RESEND_API_KEY } = env();
  if (RESEND_API_KEY) {
    return new ResendProvider(RESEND_API_KEY);
  }
  return new GmailProvider(userId);
}

export function isResendActive(): boolean {
  return Boolean(env().RESEND_API_KEY);
}
