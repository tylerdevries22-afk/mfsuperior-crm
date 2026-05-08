import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import {
  ArrowLeft,
  Phone,
  Globe,
  Mail,
  MapPin,
  StickyNote,
  Archive,
  Send,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Calendar,
} from "lucide-react";
import { db } from "@/lib/db/client";
import {
  crmNotes,
  emailEvents,
  emailSequences,
  emailTemplates,
  leadSequenceEnrollments,
  leads,
  stageEnum,
} from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StageChip, TierChip } from "@/components/leads/stage-chip";
import { Input } from "@/components/ui/input";
import {
  addNoteAction,
  archiveLeadAction,
  scheduleFollowUpAction,
  updateStageAction,
} from "./actions";
import { draftEmailAction } from "./draft-action";
import { enrollLeadAction } from "../../sequences/actions";

export const metadata = { title: "Lead" };

const STAGES = stageEnum.enumValues;

const COMPOSE_ERROR_MESSAGES: Record<string, string> = {
  no_google:
    "You haven't connected Google yet. Sign out, then sign in with the real Google button (not the dev panel) so Gmail/Drive permissions are granted.",
  no_email:
    "This lead has no email on file. Phone first, get the right contact, then add the email on this page.",
  suppressed:
    "This email is on the suppression list (unsubscribed, bounced, or replied). Cannot send to it.",
  lead_missing: "Lead not found.",
  template_missing: "Template not found.",
  settings_missing: "Settings haven't been saved yet.",
  auth: "Google rejected the request. Sign in again to refresh your token.",
  send_failed: "Gmail returned an error. Check the activity timeline for details.",
};

const ENROLL_SKIP_MESSAGES: Record<string, string> = {
  already_enrolled: "Lead is already enrolled in this sequence.",
  suppressed: "Lead's email is on the suppression list.",
  no_active_step: "Sequence has no active templates. Add or activate a template first.",
};

const EVENT_ERROR_MESSAGES: Record<string, string> = {
  lead_missing: "Lead not found.",
  bad_time: "The start time was empty or unparseable.",
  auth: "Google rejected the request. Sign in again to refresh your Calendar permission.",
  create_failed: "Calendar API returned an error. Check the audit log.",
};

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    compose_error?: string;
    compose_ok?: string;
    template?: string;
    enroll_ok?: string;
    enroll_skip?: string;
    event_ok?: string;
    event_error?: string;
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const [lead] = await db.select().from(leads).where(eq(leads.id, id));
  if (!lead) notFound();

  const [notes, events, templates, sequences, enrollments] = await Promise.all([
    db
      .select()
      .from(crmNotes)
      .where(eq(crmNotes.leadId, id))
      .orderBy(desc(crmNotes.createdAt))
      .limit(20),
    db
      .select()
      .from(emailEvents)
      .where(eq(emailEvents.leadId, id))
      .orderBy(desc(emailEvents.occurredAt))
      .limit(50),
    db
      .select({
        id: emailTemplates.id,
        name: emailTemplates.name,
        sequenceStep: emailTemplates.sequenceStep,
        sendMode: emailTemplates.sendMode,
      })
      .from(emailTemplates)
      .where(
        and(
          eq(emailTemplates.isActive, true),
          isNotNull(emailTemplates.sequenceStep),
        ),
      )
      .orderBy(asc(emailTemplates.sequenceStep), asc(emailTemplates.name)),
    db
      .select({
        id: emailSequences.id,
        name: emailSequences.name,
        status: emailSequences.status,
      })
      .from(emailSequences)
      .where(eq(emailSequences.status, "active"))
      .orderBy(asc(emailSequences.name)),
    db
      .select({
        id: leadSequenceEnrollments.id,
        sequenceId: leadSequenceEnrollments.sequenceId,
        sequenceName: emailSequences.name,
        status: leadSequenceEnrollments.status,
        currentStep: leadSequenceEnrollments.currentStep,
        nextSendAt: leadSequenceEnrollments.nextSendAt,
        pausedReason: leadSequenceEnrollments.pausedReason,
      })
      .from(leadSequenceEnrollments)
      .innerJoin(
        emailSequences,
        eq(emailSequences.id, leadSequenceEnrollments.sequenceId),
      )
      .where(eq(leadSequenceEnrollments.leadId, id))
      .orderBy(desc(leadSequenceEnrollments.updatedAt)),
  ]);

  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(" ");
  const headerName = lead.companyName ?? (fullName || "(Untitled lead)");

  // Default schedule slot: tomorrow 10:00 local (formatted for <input type="datetime-local">).
  const defaultStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours(),
    )}:${pad(d.getMinutes())}`;
  })();

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <Link
        href="/leads"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All leads
      </Link>

      <header className="mt-4 mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <TierChip tier={lead.tier} />
            <h1 className="min-w-0 break-words text-xl font-semibold tracking-tight text-foreground sm:truncate sm:text-2xl">
              {headerName}
            </h1>
          </div>
          {fullName && lead.companyName && (
            <p className="mt-1 text-sm text-muted-foreground">{fullName}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {lead.vertical && <span>{lead.vertical}</span>}
            {lead.score != null && (
              <span className="font-mono tabular-nums">
                Score {lead.score}
              </span>
            )}
            {lead.source && (
              <span className="font-mono">source: {lead.source}</span>
            )}
          </div>
        </div>
        <StageChip stage={lead.stage} className="text-sm" />
      </header>

      {sp.compose_error && (
        <div className="mb-5 flex items-start gap-3 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <div>
            <p className="font-medium text-foreground">Compose error</p>
            <p className="text-muted-foreground">
              {COMPOSE_ERROR_MESSAGES[sp.compose_error] ?? sp.compose_error}
            </p>
          </div>
        </div>
      )}
      {sp.compose_ok && (
        <div className="mb-5 flex items-start gap-3 rounded-md border border-success/40 bg-success/10 px-4 py-3 text-sm">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
          <div className="flex-1">
            <p className="font-medium text-foreground">
              {sp.compose_ok === "send"
                ? "Email sent"
                : "Draft created in Gmail"}
              {sp.template && (
                <span className="text-muted-foreground"> · {decodeURIComponent(sp.template)}</span>
              )}
            </p>
            {sp.compose_ok === "draft" && (
              <a
                href="https://mail.google.com/mail/u/0/#drafts"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:underline"
              >
                Open Gmail drafts <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        </div>
      )}
      {sp.enroll_ok && (
        <div className="mb-5 flex items-start gap-3 rounded-md border border-success/40 bg-success/10 px-4 py-3 text-sm">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
          <p className="text-foreground">
            Enrolled in sequence. The first step fires on the next cron tick (within 15 min).
          </p>
        </div>
      )}
      {sp.enroll_skip && (
        <div className="mb-5 flex items-start gap-3 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <p className="text-foreground">
            {ENROLL_SKIP_MESSAGES[sp.enroll_skip] ?? "Enrollment skipped."}
          </p>
        </div>
      )}
      {sp.event_ok && (
        <div className="mb-5 flex items-start gap-3 rounded-md border border-success/40 bg-success/10 px-4 py-3 text-sm">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
          <p className="text-foreground">
            Calendar event created and{" "}
            <span className="font-mono">nextFollowUpAt</span> updated.
          </p>
        </div>
      )}
      {sp.event_error && (
        <div className="mb-5 flex items-start gap-3 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <p className="text-foreground">
            {EVENT_ERROR_MESSAGES[sp.event_error] ?? sp.event_error}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="size-4 text-muted-foreground" />
                Compose
              </CardTitle>
            </CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No active sequence templates yet.{" "}
                  <Link href="/templates" className="text-primary hover:underline">
                    Seed the kit's Day 0/4/10 templates
                  </Link>{" "}
                  first.
                </p>
              ) : !lead.email ? (
                <p className="text-sm text-muted-foreground">
                  This lead has no email on file. Per the kit workflow,
                  call first, then add the email here.
                </p>
              ) : (
                <form
                  action={draftEmailAction}
                  className="flex flex-wrap items-end gap-3"
                >
                  <input type="hidden" name="leadId" value={lead.id} />
                  <div className="grid min-w-[220px] flex-1 gap-1.5">
                    <label
                      htmlFor="templateId"
                      className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
                    >
                      Template
                    </label>
                    <Select id="templateId" name="templateId" required>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.sequenceStep != null
                            ? `Step ${t.sequenceStep} · ${t.name}`
                            : t.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <label
                      htmlFor="mode"
                      className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
                    >
                      Mode
                    </label>
                    <Select id="mode" name="mode" defaultValue="draft" className="w-32">
                      <option value="draft">Draft</option>
                      <option value="send">Send now</option>
                    </Select>
                  </div>
                  <Button type="submit">
                    <Send /> Compose
                  </Button>
                </form>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                Drafts default. The compose pipeline injects the open pixel,
                rewrites links through the click tracker, and appends the
                CAN-SPAM footer with your business address.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stage</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                action={updateStageAction}
                className="flex items-end gap-2"
              >
                <input type="hidden" name="id" value={lead.id} />
                <div className="grid flex-1 gap-1.5">
                  <label
                    htmlFor="stage"
                    className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
                  >
                    Move to
                  </label>
                  <Select
                    id="stage"
                    name="stage"
                    defaultValue={lead.stage}
                  >
                    {STAGES.map((s) => (
                      <option key={s} value={s}>
                        {s[0].toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button type="submit" variant="secondary">
                  Update
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="size-4 text-muted-foreground" />
                Schedule follow-up
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                action={scheduleFollowUpAction}
                className="grid grid-cols-1 gap-3 sm:grid-cols-2"
              >
                <input type="hidden" name="id" value={lead.id} />
                <div className="grid gap-1.5 sm:col-span-2">
                  <label
                    htmlFor="summary"
                    className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
                  >
                    Title
                  </label>
                  <Input
                    id="summary"
                    name="summary"
                    placeholder={`Follow-up: ${headerName}`}
                  />
                </div>
                <div className="grid gap-1.5">
                  <label
                    htmlFor="startsAt"
                    className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
                  >
                    Start
                  </label>
                  <Input
                    id="startsAt"
                    name="startsAt"
                    type="datetime-local"
                    defaultValue={defaultStart}
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <label
                    htmlFor="durationMinutes"
                    className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
                  >
                    Duration (min)
                  </label>
                  <Input
                    id="durationMinutes"
                    name="durationMinutes"
                    type="number"
                    min={5}
                    max={480}
                    defaultValue={30}
                  />
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <label
                    htmlFor="description"
                    className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
                  >
                    Notes (optional)
                  </label>
                  <Textarea
                    id="description"
                    name="description"
                    rows={2}
                    placeholder="Talking points, reference attachments…"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
                  <label className="inline-flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      name="inviteLead"
                      disabled={!lead.email}
                      className="size-4 accent-primary"
                    />
                    Invite lead
                    {!lead.email && (
                      <span className="text-xs text-muted-foreground">
                        (no email on file)
                      </span>
                    )}
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      name="withMeet"
                      className="size-4 accent-primary"
                    />
                    Add Google Meet link
                  </label>
                  <Button type="submit" className="ml-auto">
                    <Calendar /> Create event
                  </Button>
                </div>
              </form>
              {lead.nextFollowUpAt && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Current next follow-up:{" "}
                  <span className="font-mono tabular-nums text-foreground">
                    {new Date(lead.nextFollowUpAt).toLocaleString()}
                  </span>
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sequence enrollment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {enrollments.length > 0 && (
                <ul className="divide-y divide-border">
                  {enrollments.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/sequences/${e.sequenceId}`}
                          className="truncate text-sm font-medium text-foreground transition-colors hover:text-primary"
                        >
                          {e.sequenceName}
                        </Link>
                        <p className="font-mono text-xs tabular-nums text-muted-foreground">
                          step {e.currentStep}
                          {e.pausedReason ? ` · ${e.pausedReason}` : ""}
                          {e.nextSendAt
                            ? ` · next ${new Date(e.nextSendAt)
                                .toISOString()
                                .slice(0, 16)
                                .replace("T", " ")}`
                            : ""}
                        </p>
                      </div>
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
                    </li>
                  ))}
                </ul>
              )}

              {sequences.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No active sequences yet.{" "}
                  <Link
                    href="/sequences"
                    className="text-primary hover:underline"
                  >
                    Seed the kit
                  </Link>{" "}
                  to create one.
                </p>
              ) : (
                <form
                  action={enrollLeadAction}
                  className="flex items-end gap-2 border-t border-border pt-3"
                >
                  <input type="hidden" name="leadId" value={lead.id} />
                  <div className="grid flex-1 gap-1.5">
                    <label
                      htmlFor="sequenceId"
                      className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
                    >
                      Enroll in
                    </label>
                    <Select id="sequenceId" name="sequenceId" required>
                      {sequences.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button type="submit" variant="secondary">
                    Enroll
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <StickyNote className="size-4 text-muted-foreground" />
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form action={addNoteAction} className="grid gap-2">
                <input type="hidden" name="id" value={lead.id} />
                <Textarea
                  name="note"
                  rows={3}
                  placeholder="Phone outcome, voicemail, decision-maker name…"
                  required
                />
                <div className="flex justify-end">
                  <Button type="submit" size="sm">
                    Add note
                  </Button>
                </div>
              </form>

              {lead.notes && (
                <article className="border-t border-border pt-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Imported notes
                  </p>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground">
                    {lead.notes}
                  </p>
                </article>
              )}

              {notes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No CRM notes yet.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {notes.map((n) => (
                    <li key={n.id} className="py-3 first:pt-0 last:pb-0">
                      <p className="whitespace-pre-line text-sm text-foreground">
                        {n.note}
                      </p>
                      <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No email events yet. Once you enroll this lead in a sequence,
                  every queue, draft, send, open, click, reply, or bounce shows
                  up here.
                </p>
              ) : (
                <ol className="relative space-y-4 border-l border-border pl-5">
                  {events.map((e) => (
                    <li key={e.id} className="relative">
                      <span className="absolute -left-[27px] top-1.5 size-2 rounded-full bg-primary ring-4 ring-background" />
                      <p className="text-sm font-medium text-foreground">
                        {e.eventType}
                      </p>
                      <p className="font-mono text-xs tabular-nums text-muted-foreground">
                        {new Date(e.occurredAt).toLocaleString()}
                        {e.sequenceStep != null && (
                          <span> · step {e.sequenceStep}</span>
                        )}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right rail */}
        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <DetailRow icon={<Mail className="size-4" />} label="Email">
                  {lead.email ? (
                    <a
                      href={`mailto:${lead.email}`}
                      className="font-mono text-foreground transition-colors hover:text-primary"
                    >
                      {lead.email}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">— call first</span>
                  )}
                </DetailRow>
                <DetailRow icon={<Phone className="size-4" />} label="Phone">
                  {lead.phone ? (
                    <a
                      href={`tel:${lead.phone}`}
                      className="font-mono text-foreground transition-colors hover:text-primary"
                    >
                      {lead.phone}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </DetailRow>
                <DetailRow icon={<Globe className="size-4" />} label="Website">
                  {lead.website ? (
                    <a
                      href={
                        lead.website.startsWith("http")
                          ? lead.website
                          : `https://${lead.website}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-foreground transition-colors hover:text-primary"
                    >
                      {lead.website}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </DetailRow>
                <DetailRow
                  icon={<MapPin className="size-4" />}
                  label="Location"
                >
                  {lead.address ? (
                    <span className="text-foreground">{lead.address}</span>
                  ) : lead.city ? (
                    <span className="text-foreground">
                      {lead.city}
                      {lead.state ? `, ${lead.state}` : ""}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </DetailRow>
              </dl>
            </CardContent>
          </Card>

          {lead.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {lead.tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center rounded-sm bg-secondary px-1.5 py-0.5 text-xs font-medium leading-none text-secondary-foreground ring-1 ring-inset ring-border"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-destructive">Danger zone</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={archiveLeadAction}>
                <input type="hidden" name="id" value={lead.id} />
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Archive /> Archive lead
                </Button>
              </form>
              <p className="mt-2 text-xs text-muted-foreground">
                Archived leads are hidden from list views. Email events and
                notes are preserved.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[20px_1fr] items-start gap-2.5">
      <span className="mt-0.5 text-muted-foreground" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="sr-only">{label}</dt>
        <dd className="truncate">{children}</dd>
      </div>
    </div>
  );
}
