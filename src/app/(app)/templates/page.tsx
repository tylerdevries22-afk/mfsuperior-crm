import Link from "next/link";
import { asc, desc } from "drizzle-orm";
import { Plus, Sparkles, Mail } from "lucide-react";
import { db } from "@/lib/db/client";
import { emailTemplates } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { seedKitTemplatesAction } from "./actions";

export const metadata = { title: "Templates" };

export default async function TemplatesPage() {
  const rows = await db
    .select()
    .from(emailTemplates)
    .orderBy(
      desc(emailTemplates.isActive),
      asc(emailTemplates.sequenceStep),
      desc(emailTemplates.updatedAt),
    );

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Templates
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Outbound email templates with{" "}
            <code className="font-mono">{"{{variable}}"}</code> substitution.
            Drafts go to your Gmail; you press send.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {rows.length === 0 && (
            <form action={seedKitTemplatesAction}>
              <Button type="submit" variant="secondary">
                <Sparkles /> Seed kit (Day 0/4/10)
              </Button>
            </form>
          )}
          <Link href="/templates/new">
            <Button>
              <Plus /> New template
            </Button>
          </Link>
        </div>
      </header>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 px-6 py-10 text-sm">
            <p className="font-medium text-foreground">No templates yet.</p>
            <p className="max-w-xl text-muted-foreground">
              The fastest way to start: seed the three templates from{" "}
              <span className="font-mono">02_Email_Template.md</span> (Day 0
              outreach, Day 4 follow-up, Day 10 closing the loop). You can
              edit them after.
            </p>
            <form action={seedKitTemplatesAction}>
              <Button type="submit">
                <Sparkles /> Seed kit templates
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {rows.map((t) => (
            <li key={t.id}>
              <Link
                href={`/templates/${t.id}`}
                className="group block rounded-md border border-border bg-card transition-colors active:translate-y-[1px] hover:border-brand-300"
              >
                <div className="flex items-start justify-between gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {t.sequenceStep != null && (
                        <Badge variant="brand">
                          Step {t.sequenceStep}
                        </Badge>
                      )}
                      <h3 className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                        {t.name}
                      </h3>
                      {!t.isActive && (
                        <Badge variant="muted">Inactive</Badge>
                      )}
                    </div>
                    <p className="mt-1.5 truncate text-sm text-muted-foreground">
                      <Mail className="mr-1.5 inline-block size-3.5 -translate-y-px" />
                      {t.subject}
                    </p>
                  </div>
                  <Badge variant={t.sendMode === "draft" ? "neutral" : "warning"}>
                    {t.sendMode === "draft" ? "Draft" : "Auto-send"}
                  </Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
