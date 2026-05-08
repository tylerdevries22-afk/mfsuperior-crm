"use server";

import { db } from "@/lib/db/client";
import { notifications } from "@/lib/db/schema";
import { isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function markAllReadAction() {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(isNull(notifications.readAt));

  revalidatePath("/notifications");
}
