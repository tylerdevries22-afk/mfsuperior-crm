"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { sessions, users } from "@/lib/db/schema";

/**
 * DEV-ONLY sign-in.
 *
 * Bypasses Google OAuth so the app can be exercised locally before a real
 * OAuth client is configured. Creates (or finds) a user by email, writes a
 * session row, and sets the same cookie Auth.js looks up. Strictly gated by
 * `NODE_ENV !== "production"` — calling it in production throws.
 */
export async function devSignInAction(formData: FormData) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Dev sign-in is disabled in production.");
  }

  const email = z
    .string()
    .email()
    .parse(formData.get("email"))
    .toLowerCase();

  const name =
    (formData.get("name") as string | null)?.trim() || email.split("@")[0];

  // Find or create the user.
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  let userId: string;
  if (existing[0]) {
    userId = existing[0].id;
  } else {
    const [created] = await db
      .insert(users)
      .values({
        email,
        name,
        emailVerified: sql`now()`,
      })
      .returning({ id: users.id });
    userId = created.id;
  }

  // Insert a session keyed by a fresh token; 30-day expiry.
  const sessionToken = randomUUID();
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  await db.insert(sessions).values({
    sessionToken,
    userId,
    expires,
  });

  // Cookie name matches Auth.js v5 default for HTTP (non-Secure) dev.
  const cookieStore = await cookies();
  cookieStore.set({
    name: "authjs.session-token",
    value: sessionToken,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires,
  });

  redirect("/dashboard");
}
