import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db/client";
import { emailTemplates, leads, settings } from "@/lib/db/schema";
import { TemplateEditor } from "@/components/templates/template-editor";
import { upsertTemplateAction } from "../actions";
import { buildVariableMap } from "@/lib/email/render";

export const metadata = { title: "Edit template" };

const NEW_DEFAULTS = {
  name: "New template",
  subject: "Subject for {{company_name}}",
  bodyHtml: `<p>Hi {{first_name}},</p>\n<p>...</p>\n<p>Best,<br />\n{{sender_name}}</p>`,
  bodyText: `Hi {{first_name}},\n\n...\n\nBest,\n{{sender_name}}`,
  sendMode: "draft" as const,
  isActive: true,
  sequenceStep: null,
};

type LoadResult =
  | { kind: "new" }
  | { kind: "found"; row: typeof emailTemplates.$inferSelect }
  | { kind: "missing" };

async function loadTemplate(id: string): Promise<LoadResult> {
  if (id === "new") return { kind: "new" };
  const [row] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id));
  return row ? { kind: "found", row } : { kind: "missing" };
}

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const result = await loadTemplate(id);
  if (result.kind === "missing") notFound();
  const initial =
    result.kind === "found"
      ? { ...result.row, sendMode: result.row.sendMode as "draft" | "auto_send" }
      : { id: undefined as string | undefined, ...NEW_DEFAULTS };

  // Sample-lead context for the live preview.
  const [topLead] = await db
    .select()
    .from(leads)
    .where(eq(leads.tier, "A"))
    .limit(1);
  const [config] = await db.select().from(settings).where(eq(settings.id, 1));

  const sampleVars = buildVariableMap(
    topLead ?? {
      firstName: "Sam",
      companyName: "Elite Brands of Colorado",
      city: "Denver",
      state: "CO",
      vertical: "Beverage Distributor",
    },
    {
      senderName: config?.senderName ?? "Tyler DeVries",
      senderEmail: config?.senderEmail ?? "tylerdevries22@gmail.com",
      businessName: config?.businessName ?? "MF Superior Products",
      senderTitle: "Owner",
      senderPhone: "(303) 555-0119",
      businessMc: config?.businessMc ?? null,
      businessUsdot: config?.businessUsdot ?? null,
    },
    { callTime: "Thursday at 9 AM" },
  );

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <Link
        href="/templates"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All templates
      </Link>

      <header className="mt-4 mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {result.kind === "found" ? "Edit template" : "New template"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The right rail shows a live preview using your top tier-A lead as
          the sample. Tracking pixels and CAN-SPAM footer are appended at
          send time, not in this preview.
        </p>
      </header>

      <TemplateEditor
        initial={{
          id: result.kind === "found" ? result.row.id : undefined,
          name: initial.name,
          subject: initial.subject,
          bodyHtml: initial.bodyHtml,
          bodyText: initial.bodyText,
          sendMode: initial.sendMode,
          isActive: initial.isActive,
          sequenceStep: initial.sequenceStep ?? null,
        }}
        action={upsertTemplateAction}
        sampleVars={sampleVars}
      />
    </div>
  );
}
