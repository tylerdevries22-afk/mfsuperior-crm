import { eq, sql } from "drizzle-orm";
import { google } from "googleapis";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { ProviderAuthError } from "@/lib/email/provider";

/**
 * Resolve a usable Google OAuth access token for a given Auth.js user.
 *
 * The Drizzle adapter stores the original refresh + access tokens in the
 * `accounts` table; we use the refresh token to mint a fresh access token
 * on demand. (The access token in the DB will be stale after an hour, so
 * we always do a refresh — caching across requests is a future optimization.)
 *
 * Throws ProviderAuthError if the user has not connected Google or the
 * refresh fails (token revoked, scope changed, etc.).
 */
export async function getGoogleAccessToken(userId: string): Promise<string> {
  const [acct] = await db
    .select({
      refresh: accounts.refresh_token,
      access: accounts.access_token,
      expiresAt: accounts.expires_at,
    })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);

  if (!acct) {
    throw new ProviderAuthError(
      "No Google account connected. Sign in with Google to grant Gmail access.",
    );
  }
  if (!acct.refresh) {
    throw new ProviderAuthError(
      "Google account is connected but no refresh token is stored. Re-authenticate with Google (you may need to revoke and reconnect).",
    );
  }

  // If we have a valid access token with >2 minutes of life left, reuse it.
  const now = Math.floor(Date.now() / 1000);
  if (acct.access && acct.expiresAt && acct.expiresAt - now > 120) {
    return acct.access;
  }

  const client = new google.auth.OAuth2(
    env().AUTH_GOOGLE_ID,
    env().AUTH_GOOGLE_SECRET,
  );
  client.setCredentials({ refresh_token: acct.refresh });

  let credentials;
  try {
    const result = await client.refreshAccessToken();
    credentials = result.credentials;
  } catch (err) {
    throw new ProviderAuthError(
      `Google token refresh failed: ${(err as Error).message}. The token may have been revoked — sign in again.`,
    );
  }
  if (!credentials.access_token) {
    throw new ProviderAuthError("Google did not return an access token.");
  }

  // Persist the new access token + expiry so subsequent calls can reuse it.
  if (credentials.expiry_date) {
    await db
      .update(accounts)
      .set({
        access_token: credentials.access_token,
        expires_at: Math.floor(credentials.expiry_date / 1000),
      })
      .where(eq(accounts.userId, userId));
  }

  return credentials.access_token;
}

/** Build an authed googleapis Gmail client for the given user. */
export async function getGmailClient(userId: string) {
  const accessToken = await getGoogleAccessToken(userId);
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth });
}

export async function userHasGoogleConnection(userId: string): Promise<boolean> {
  const [acct] = await db
    .select({ refresh: accounts.refresh_token })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);
  return !!acct?.refresh;
}

// Suppress unused import noise when sql helpers aren't referenced.
void sql;
