import { and, eq, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { leads } from "@/lib/db/schema";

/**
 * GET /api/export/denver-batch-1 — streams a CSV of every lead with
 * source='denver-batch-1' for the operator to download. Auth-gated;
 * same session model as the rest of /admin.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("unauthorized", { status: 401 });
  }

  const rows = await db
    .select()
    .from(leads)
    .where(
      and(eq(leads.source, "denver-batch-1"), isNull(leads.archivedAt)),
    )
    .orderBy(leads.tier, leads.companyName);

  const header = [
    "companyName",
    "website",
    "email",
    "phone",
    "address",
    "city",
    "state",
    "vertical",
    "tier",
    "tags",
    "notes",
    "stage",
    "source",
    "createdAt",
  ] as const;

  const escape = (v: unknown): string => {
    if (v == null) return "";
    const s = Array.isArray(v) ? v.join("|") : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const csv = [
    header.join(","),
    ...rows.map((r) =>
      header
        .map((h) => {
          const v = r[h as keyof typeof r];
          if (v instanceof Date) return escape(v.toISOString());
          return escape(v);
        })
        .join(","),
    ),
  ].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="leads-denver-batch-1.csv"',
    },
  });
}
