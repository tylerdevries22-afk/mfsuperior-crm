import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { GitBranch, Sparkles } from "lucide-react";
import { db } from "@/lib/db/client";
import {
  emailSequences,
  emailTemplates,
  leadSequenceEnrollments,
} from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { seedKitTemplatesAction } from "../templates/actions";

export const metadata = { title: "Sequences" };

export default async function SequencesPage() {
  const rows = await db
    .select({
      id: emailSequences.id,
      name: emailSequences.name,
      status: emailSequences.status,
      stepCount: sql<number>`(SELECT COUNT(*)::int FROM ${emailTemplates} t WHERE t.sequence_id = ${emailSequences.id})`,
      activeEnrollments: sql<number>`(SELECT COUNT(*)::int FROM ${leadSequenceEnrollments} e WHERE e.sequence_id = ${emailSequences.id} AND e.status = 'active')`,
      pausedEnrollments: sql<number>`(SELECT COUNT(*)::int FROM ${leadSequenceEnrollments} e WHERE e.sequence_id = ${emailSequences.id} AND e.status IN ('paused','stopped'))`,
      completedEnrollments: sql<number>`(SELECT COUNT(*)::int FROM ${leadSequenceEnrollments} e WHERE e.sequence_id = ${emailSequences.id} AND e.status = 'completed')`,
    })
    .from(emailSequences)
    .orderBy(asc(emailSequences.name));

  // Suppress unused-import noise.
  void eq;

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Sequences
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Multi-step automation. The Day 0 / 4 / 10 cadence is the kit's
            default; cron ticks every 15 minutes.
          </p>
        </div>
        {rows.length === 0 && (
          <form action={seedKitTemplatesAction} className="w-full sm:w-auto">
            <Button type="submit" variant="secondary" className="w-full sm:w-auto">
              <Sparkles /> Seed kit (Day 0/4/10)
            </Button>
          </form>
        )}
      </header>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 px-6 py-10 text-sm">
            <p className="font-medium text-foreground">No sequences yet.</p>
            <p className="max-w-xl text-muted-foreground">
              Seeding the kit creates the Denver three-touch sequence with
              the Day 0 / Day 4 / Day 10 templates and links them together.
              You can edit each template after.
            </p>
            <form action={seedKitTemplatesAction}>
              <Button type="submit">
                <Sparkles /> Seed kit
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {rows.map((s) => (
            <li key={s.id}>
              <Link
                href={`/sequences/${s.id}`}
                className="group block rounded-md border border-border bg-card transition-colors active:translate-y-[1px] hover:border-brand-300"
              >
                <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <GitBranch className="size-4 text-muted-foreground" />
                      <h3 className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                        {s.name}
                      </h3>
                      <Badge variant={s.status === "active" ? "brand" : "muted"}>
                        {s.status}
                      </Badge>
                    </div>
                    <p className="mt-1.5 font-mono text-xs tabular-nums text-muted-foreground">
                      {s.stepCount} step{s.stepCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 sm:text-right">
                    <Stat label="Active" value={s.activeEnrollments} accent />
                    <Stat label="Paused" value={s.pausedEnrollments} muted />
                    <Stat label="Done" value={s.completedEnrollments} muted />
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent = false,
  muted = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={
          accent
            ? "font-mono text-sm font-semibold tabular-nums text-primary"
            : muted
              ? "font-mono text-sm font-semibold tabular-nums text-muted-foreground"
              : "font-mono text-sm font-semibold tabular-nums text-foreground"
        }
      >
        {value}
      </p>
    </div>
  );
}
