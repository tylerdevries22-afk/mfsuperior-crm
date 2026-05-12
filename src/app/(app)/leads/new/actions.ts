"use server";

import { redirect } from "next/navigation";
import { and, eq, isNull, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { leads } from "@/lib/db/schema";

/**
 * Server action for the "New lead" form (`/leads/new`).
 *
 * Failure handling: every error becomes a redirect back to the form
 * with an `err=<message>` query param the page renders as a banner.
 * Previously any DB error (duplicate email, duplicate company with
 * null email — both caught by partial unique indexes on the leads
 * table) became an uncaught throw → Next.js generic "A server error
 * occurred" screen with no signal for the operator.
 */
export async function createLeadAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(buildErrorRedirect("Sign in again — your session expired."));
  }
  const get = (key: string) =>
    (formData.get(key) as string | null)?.trim() || null;

  const companyName = get("company");
  const firstName = get("firstName");
  const lastName = get("lastName");
  const email = get("email")?.toLowerCase() || null;
  const phone = get("phone");
  const vertical = get("vertical");
  const city = get("city");
  const state = get("state");
  const website = get("website");
  const notesRaw = get("notes");

  const tierRaw = get("tier");
  const tier =
    tierRaw === "A" || tierRaw === "B" || tierRaw === "C" ? tierRaw : null;

  // Cheap up-front validation. Without at least a company name OR a
  // human name we'd insert a completely blank row — almost certainly
  // a misclick.
  if (!companyName && !firstName && !lastName) {
    redirect(
      buildErrorRedirect(
        "Add at least a company name or contact name before saving.",
        formData,
      ),
    );
  }

  // Pre-check duplicates so we can return a specific message instead
  // of a generic "unique constraint violation" string. Two cases:
  //   • email match (the `leads_email_unique` partial index)
  //   • same company name with no email (the
  //     `leads_company_no_email_unique` partial index)
  if (email) {
    const dup = await db
      .select({ id: leads.id })
      .from(leads)
      .where(eq(leads.email, email))
      .limit(1);
    if (dup.length > 0) {
      redirect(
        buildErrorRedirect(
          `A lead with email ${email} already exists. Open it from /leads to edit.`,
          formData,
        ),
      );
    }
  } else if (companyName) {
    const dup = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.companyName, companyName), isNull(leads.email)))
      .limit(1);
    if (dup.length > 0) {
      redirect(
        buildErrorRedirect(
          `A lead for "${companyName}" without an email already exists. Open it to add contact info.`,
          formData,
        ),
      );
    }
  }

  let insertedId: string | undefined;
  let errorRedirect: string | undefined;
  try {
    const [inserted] = await db
      .insert(leads)
      .values({
        companyName,
        firstName,
        lastName,
        email,
        phone,
        vertical,
        city,
        state,
        website,
        tier,
        notes: notesRaw,
        source: "manual",
      })
      .returning({ id: leads.id });
    insertedId = inserted?.id;
  } catch (err) {
    // Drizzle wraps the Postgres error; the unique-violation code is
    // 23505. Anything else falls through to a generic message.
    const e = err as { code?: string; message?: string };
    if (e?.code === "23505") {
      errorRedirect = buildErrorRedirect(
        "That email or company is already in the leads table — open the existing record to edit.",
        formData,
      );
    } else {
      console.error("[createLead] insert failed:", e?.message ?? err);
      errorRedirect = buildErrorRedirect(
        `Couldn't save the lead: ${e?.message?.slice(0, 120) ?? "unknown error"}`,
        formData,
      );
    }
  }

  // Redirects throw to short-circuit the action; doing them outside
  // try/catch keeps the redirect signal (NEXT_REDIRECT) from being
  // swallowed by our catch.
  if (errorRedirect) redirect(errorRedirect);
  if (!insertedId) {
    redirect(
      buildErrorRedirect(
        "Insert returned no row. Please retry; if this keeps happening, check /admin Health.",
        formData,
      ),
    );
  }
  redirect(`/leads/${insertedId}`);
}

/**
 * Build the URL to redirect back to the form on failure. Re-encodes
 * the user's filled-in fields as query params so we can repopulate
 * the form via `defaultValue=...` and they don't have to retype.
 */
function buildErrorRedirect(message: string, formData?: FormData): string {
  const params = new URLSearchParams({ err: message });
  if (formData) {
    const preserve = [
      "company",
      "firstName",
      "lastName",
      "email",
      "phone",
      "vertical",
      "city",
      "state",
      "website",
      "tier",
      "notes",
    ];
    for (const k of preserve) {
      const v = (formData.get(k) as string | null)?.trim();
      if (v) params.set(`f_${k}`, v);
    }
  }
  return `/leads/new?${params.toString()}`;
}
// Silence unused-import warning while keeping `sql` available for
// future extensions (e.g. case-insensitive duplicate checks).
void sql;
