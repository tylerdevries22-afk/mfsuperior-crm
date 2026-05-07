import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { ArrowLeft, AlertTriangle, CheckCircle2 } from "lucide-react";
import { db } from "@/lib/db/client";
import {
  emailSequences,
  emailTemplates,
  leadSequenceEnrollments,
  leads,
} from "@/lib/db/schema";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { StageChip, TierChip } from "@/components/leads/stage-chip";
import { enrollByFilterAction } from "../actions";

export const metadata = { title: "Sequence" };

const STAGES = ["new", "contacted", "replied", "quoted", "won", "lost"] as const;

type Search = {
  bulk_enrolled?: string;
  bulk_skipped?: string;
  bulk_candidates?: string;
};

export default async function SequenceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Search>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const [sequence] = await db
    .select()
    .from(emailSequences)
    .where(eq(emailSequences.id, id))
    .limit(1);
  if (!sequence) notFound();

  const [steps, enrollmentRows] = await Promise.all([
    db
      .select({
        id: emailTemplates.id,
        name: emailTemplates.name,
        sequenceStep: emailTemplates.sequenceStep,
        sendMode: emailTemplates.sendMode,
        isActive: emailTemplates.isActive,
        subject: emailTemplates.subject,
      })
      .from(emailTemplates)
      .where(eq(emailTemplates.sequenceId, id))
      .orderBy(asc(emailTemplates.sequenceStep)),
    db
      .select({
        id: leadSequenceEnrollments.id,
        leadId: leadSequenceEnrollments.leadId,
        status: leadSequenceEnrollments.status,
        currentStep: leadSequenceEnrollments.currentStep,
        nextSendAt: leadSequenceEnrollments.nextSendAt,
        pausedReason: leadSequenceEnrollments.pausedReason,
        leadName: leads.companyName,
        leadStage: leads.stage,
        leadTier: leads.tier,
        leadEmail: leads.email,
      })
      .from(leadSequenceEnrollments)
      .innerJoin(leads, eq(leads.id, leadSequenceEnrollments.leadId))
      .where(eq(leadSequenceEnrollments.sequenceId, id))
      .orderBy(desc(leadSequenceEnrollments.updatedAt))
      .limit(100),
  ]);

  const counts = enrollmentRows.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    { active: 0, paused: 0, completed: 0, stopped: 0 } as Record<string, number>,
  );

  // Suppress unused-import noise on `and`.
  void and;

  return (
    <div className="px-8 py-8">
      <Link
        href="/sequences"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All sequences
      </Link>

      <header className="mt-4 mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {sequence.name}
          </h1>
          <Badge variant={sequence.status === "active" ? "brand" : "muted"}>
            {sequence.status}
          </Badge>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <Stat label="Active" value={counts.active} accent />
          <Stat label="Paused" value={counts.paused} muted />
          <Stat label="Completed" value={counts.completed} muted />
          <Stat label="Stopped" value={counts.stopped} muted />
        </div>
      </header>

      {sp.bulk_enrolled !== undefined && (
        <div className="mb-5 flex items-start gap-3 rounded-md border border-success/40 bg-success/10 px-4 py-3 text-sm">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
          <p className="text-foreground">
            Enrolled <span className="font-mono tabular-nums">{sp.bulk_enrolled}</span> of{" "}
            <span className="font-mono tabular-nums">{sp.bulk_candidates}</span> matching leads.{" "}
            {Number(sp.bulk_skipped ?? 0) > 0 && (
              <span className="text-muted-foreground">
                Skipped <span className="font-mono tabular-nums">{sp.bulk_skipped}</span> already
                enrolled or suppressed.
              </span>
            )}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Steps */}
          <Card>
            <CardHeader>
              <CardTitle>Steps</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {steps.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-muted-foreground">
                  No steps yet. Open <Link href="/templates" className="text-primary hover:underline">Templates</Link> to add some.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-card text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-6 py-2.5 font-medium w-16">Step</th>
                      <th className="px-3 py-2.5 font-medium">Name</th>
                      <th className="px-3 py-2.5 font-medium">Mode</th>
                      <th className="px-3 py-2.5 font-medium">Active</th>
                      <th className="px-6 py-2.5 font-medium" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {steps.map((s) => (
                      <tr key={s.id} className="transition-colors hover:bg-secondary/40">
                        <td className="px-6 py-2.5 font-mono tabular-nums text-foreground">
                          {s.sequenceStep ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 text-foreground">{s.name}</td>
                        <td className="px-3 py-2.5">
                          <Badge variant={s.sendMode === "draft" ? "neutral" : "warning"}>
                            {s.sendMode === "draft" ? "Draft" : "Auto-send"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {s.isActive ? "Yes" : "No"}
                        </td>
                        <td className="px-6 py-2.5 text-right">
                          <Link
                            href={`/templates/${s.id}`}
                            className="text-xs font-medium text-primary transition-colors hover:underline"
                          >
                            Edit →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* Enrolled leads */}
          <Card>
            <CardHeader>
              <CardTitle>Enrolled leads</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {enrollmentRows.length === 0 ? (
                <div className="px-6 pb-6 text-sm">
                  <p className="font-medium text-foreground">No enrollments yet.</p>
                  <p className="mt-1 text-muted-foreground">
                    Use the form on the right to bulk-enroll leads matching a tier and stage.
                  </p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-card text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-6 py-2.5 font-medium">Lead</th>
                      <th className="px-3 py-2.5 font-medium">Stage</th>
                      <th className="px-3 py-2.5 font-medium">Status</th>
                      <th className="px-3 py-2.5 font-medium">Step</th>
                      <th className="px-3 py-2.5 font-medium">Next send</th>
                      <th className="px-6 py-2.5 font-medium">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {enrollmentRows.map((e) => (
                      <tr key={e.id} className="transition-colors hover:bg-secondary/40">
                        <td className="px-6 py-2.5">
                          <Link
                            href={`/leads/${e.leadId}`}
                            className="flex items-center gap-2 font-medium text-foreground transition-colors hover:text-primary"
                          >
                            <TierChip tier={e.leadTier} />
                            <span className="truncate">{e.leadName ?? e.leadEmail ?? "—"}</span>
                          </Link>
                        </td>
                        <td className="px-3 py-2.5">
                          <StageChip stage={e.leadStage} />
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge
                            variant={
                              e.status === "active"
                                ? "brand"
                                : e.status === "completed"
                                  ? "success"
                                  : e.status === "paused"
                                    ? "warning"
                                    : "muted"
                            }
                          >
                            {e.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 font-mono tabular-nums text-foreground">
                          {e.currentStep}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs tabular-nums text-muted-foreground">
                          {e.nextSendAt
                            ? new Date(e.nextSendAt).toISOString().slice(0, 16).replace("T", " ")
                            : "—"}
                        </td>
                        <td className="px-6 py-2.5 text-xs text-muted-foreground">
                          {e.pausedReason ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Bulk enroll</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-xs text-muted-foreground">
                Enrolls all leads matching the filters below. Already-enrolled
                or suppressed leads are skipped (idempotent).
              </p>
              <form action={enrollByFilterAction} className="grid gap-3">
                <input type="hidden" name="sequenceId" value={sequence.id} />
                <div className="grid gap-1.5">
                  <Label htmlFor="bulk-tier">Tier</Label>
                  <Select id="bulk-tier" name="tier" defaultValue="A">
                    <option value="">All tiers</option>
                    <option value="A">A only</option>
                    <option value="B">B only</option>
                    <option value="C">C only</option>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="bulk-stage">Stage</Label>
                  <Select id="bulk-stage" name="stage" defaultValue="new">
                    <option value="">Any stage</option>
                    {STAGES.map((s) => (
                      <option key={s} value={s}>
                        {s[0].toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="bulk-q">Search</Label>
                  <Input
                    id="bulk-q"
                    name="q"
                    placeholder="company / city / vertical"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="bulk-limit">Max to enroll</Label>
                  <Input
                    id="bulk-limit"
                    name="limit"
                    type="number"
                    min={1}
                    max={500}
                    defaultValue={10}
                  />
                </div>
                <label className="flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    name="hasEmailOnly"
                    value="on"
                    defaultChecked
                    className="mt-0.5 size-4 cursor-pointer rounded border-border accent-[--primary]"
                  />
                  <span>
                    Only enroll leads <em>with</em> an email on file. Recommended — leads without
                    emails will block at compose time anyway.
                  </span>
                </label>
                <Button type="submit">Enroll matching leads</Button>
              </form>
            </CardContent>
          </Card>

          {!steps.length && (
            <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              <p className="text-foreground">
                No templates linked yet. Without active steps, the tick engine
                will mark new enrollments as completed immediately.
              </p>
            </div>
          )}
        </aside>
      </div>
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
    <div className="flex items-baseline gap-1.5">
      <p
        className={
          accent
            ? "font-mono text-base font-semibold tabular-nums text-primary"
            : muted
              ? "font-mono text-base font-semibold tabular-nums text-muted-foreground"
              : "font-mono text-base font-semibold tabular-nums text-foreground"
        }
      >
        {value}
      </p>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
