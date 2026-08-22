"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { auditLog } from "@/lib/db/schema";
import { PARTNER_CATEGORIES, type PartnerCategory } from "@/data/partners";
import {
  PartnerWriteError,
  addPartner,
  setPartnerStatus,
} from "@/lib/partners/store";

/**
 * Server actions behind Admin → Partners.
 *
 * Both redirect back to the tab with a `?partnerResult=` message so the
 * outcome survives the POST-redirect-GET the surrounding admin page uses for
 * every other action, rather than needing client state.
 */

const TAB_PATH = "/admin?tab=partners";

function backWith(message: string): never {
  redirect(`${TAB_PATH}&partnerResult=${encodeURIComponent(message)}`);
}

function isCategory(value: unknown): value is PartnerCategory {
  return (
    typeof value === "string" &&
    (PARTNER_CATEGORIES as string[]).includes(value)
  );
}

/** Best-effort audit trail; a logging failure must not lose the write. */
async function record(
  actorUserId: string,
  action: string,
  payload: Record<string, unknown>,
) {
  try {
    await db.insert(auditLog).values({
      actorUserId,
      entity: "settings",
      entityId: null,
      action,
      beforeJson: null,
      afterJson: payload,
    });
  } catch {
    // Non-fatal.
  }
}

export async function togglePartnerStatusAction(
  formData: FormData,
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) backWith("Not signed in.");

  const slug = String(formData.get("slug") ?? "");
  const next = formData.get("status") === "active" ? "active" : "target";

  try {
    await setPartnerStatus(slug, next);
    await record(session.user.id, "partner_status_change", { slug, next });
  } catch (error) {
    backWith(
      error instanceof PartnerWriteError
        ? error.message
        : "The partner status could not be saved.",
    );
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/carrier");
  backWith(`Moved ${slug} to ${next}.`);
}

export async function uploadPartnerLogoAction(
  formData: FormData,
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) backWith("Not signed in.");

  const name = String(formData.get("name") ?? "");
  const rawCategory = formData.get("category");
  const category: PartnerCategory = isCategory(rawCategory)
    ? rawCategory
    : "broker";
  const status = formData.get("status") === "active" ? "active" : "target";
  const file = formData.get("logo");

  if (!(file instanceof File)) backWith("Choose a logo file to upload.");

  try {
    const partner = await addPartner({ name, category, status, file });
    await record(session.user.id, "partner_logo_upload", {
      slug: partner.slug,
      logo: partner.logo,
      category,
      status,
    });
    revalidatePath("/admin");
    revalidatePath("/dashboard");
    revalidatePath("/carrier");
    backWith(`Saved ${partner.name} (${partner.logo}).`);
  } catch (error) {
    backWith(
      error instanceof PartnerWriteError
        ? error.message
        : "The logo could not be saved.",
    );
  }
}
