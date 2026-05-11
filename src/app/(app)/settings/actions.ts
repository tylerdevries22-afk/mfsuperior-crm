"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { settings } from "@/lib/db/schema";
import { auth } from "@/lib/auth";

const schema = z.object({
  businessName: z.string().min(1).max(200),
  businessAddress: z.string().min(1).max(500),
  businessMc: z.string().max(40).optional().or(z.literal("")),
  businessUsdot: z.string().max(40).optional().or(z.literal("")),
  senderName: z.string().min(1).max(120),
  senderEmail: z.string().email(),
  senderTitle: z.string().max(120).optional().or(z.literal("")),
  senderPhone: z.string().max(40).optional().or(z.literal("")),
  dailySendCap: z.coerce.number().int().min(1).max(500),
  driveFolderId: z.string().max(120).optional().or(z.literal("")),
});

export async function saveSettingsAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const parsed = schema.parse({
    businessName: formData.get("businessName"),
    businessAddress: formData.get("businessAddress"),
    businessMc: formData.get("businessMc") ?? "",
    businessUsdot: formData.get("businessUsdot") ?? "",
    senderName: formData.get("senderName"),
    senderEmail: formData.get("senderEmail"),
    senderTitle: formData.get("senderTitle") ?? "",
    senderPhone: formData.get("senderPhone") ?? "",
    dailySendCap: formData.get("dailySendCap"),
    driveFolderId: formData.get("driveFolderId") ?? "",
  });

  const values = {
    id: 1 as const,
    businessName: parsed.businessName,
    businessAddress: parsed.businessAddress,
    businessMc: parsed.businessMc || null,
    businessUsdot: parsed.businessUsdot || null,
    senderName: parsed.senderName,
    senderEmail: parsed.senderEmail,
    senderTitle: parsed.senderTitle || null,
    senderPhone: parsed.senderPhone || null,
    dailySendCap: parsed.dailySendCap,
    driveFolderId: parsed.driveFolderId || null,
    updatedAt: sql`now()`,
  };

  await db
    .insert(settings)
    .values(values)
    .onConflictDoUpdate({ target: settings.id, set: values });

  revalidatePath("/settings");
}
