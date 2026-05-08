"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { leads } from "@/lib/db/schema";

export async function createLeadAction(formData: FormData) {
  const get = (key: string) => (formData.get(key) as string | null)?.trim() || null;

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

  redirect(`/leads/${inserted.id}`);
}
