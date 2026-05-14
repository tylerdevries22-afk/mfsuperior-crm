import { and, asc, eq, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  emailEvents,
  emailTemplates,
  leadSequenceEnrollments,
  leads,
  settings as settingsTable,
  suppressionList,
  users,
} from "@/lib/db/schema";
import { composeEmail } from "@/lib/email/compose";
import {
  ProviderAuthError,
  ProviderRateLimitError,
  type EmailProvider,
} from "@/lib/email/provider";
import { getEmailProvider, isResendActive } from "@/lib/email/get-provider";
import { userHasGoogleConnection } from "@/lib/gmail/oauth";
import { env } from "@/lib/env";

export type TickReport = {
  startedAt: string;
  finishedAt: string;
  due: number;
  drafted: number;
  sent: number;
  paused: number;
  completed: number;
  skippedSuppressed: number;
  skippedNoEmail: number;
  skippedInvalidEmail: number;
  skippedCapped: number;
  failed: number;
  durationMs: number;
  notes: string[];
};

type TickOptions = {
  /** Provider factory; injected for tests. */
  providerFor: (userId: string) => EmailProvider;
  /** "Now" — injected for tests. */
  now?: Date;
  /** Override daily cap (otherwise read from settings). */
  dailyCapOverride?: number;
};


export async function tickSequences(opts: TickOptions): Promise<TickReport> {
  const start = opts.now ?? new Date();
  const startedAt = start.toISOString();
  const startMs = start.getTime();
  const notes: string[] = [];

  const report: TickReport = {
    startedAt,
    finishedAt: startedAt,
    due: 0,
    drafted: 0,
    sent: 0,
    paused: 0,
    completed: 0,
    skippedSuppressed: 0,
    skippedNoEmail: 0,
    skippedInvalidEmail: 0,
    skippedCapped: 0,
    failed: 0,
    durationMs: 0,
    notes,
  };

  // 1. Resolve the operator user (single-user MVP — pick the first user with
  //    a connected Google account). If none, every due enrollment is left
  //    alone for the next tick to re-attempt.
  const operatorUser = await findOperatorUser();
  if (!operatorUser) {
    notes.push("no operator user with Google connection — skipping all due enrollments");
    return finalize(report, startMs);
  }

  // 2. Load settings (daily cap, business identity for footer).
  const [config] = await db.select().from(settingsTable).where(eq(settingsTable.id, 1));
  if (!config) {
    notes.push("settings row missing — open /settings and save");
    return finalize(report, startMs);
  }

  // Lazily stamp warmup start on the first tick that finds due enrollments.
  // We wait until we know there's real work to do so quiet restarts don't
  // eat warmup days prematurely.
  let warmupStartedAt = config.warmupStartedAt;
  if (!warmupStartedAt) {
    warmupStartedAt = start;
    await db
      .update(settingsTable)
      .set({ warmupStartedAt: start, updatedAt: sql`now()` })
      .where(eq(settingsTable.id, 1));
  }

  const e = env();
  const daysSinceWarmup =
    (start.getTime() - new Date(warmupStartedAt).getTime()) / 86_400_000;
  const inWarmup = e.WARMUP_DAYS > 0 && daysSinceWarmup < e.WARMUP_DAYS;
  const rawCap = opts.dailyCapOverride ?? config.dailySendCap;
  const dailyCap = inWarmup ? Math.min(rawCap, e.WARMUP_DAILY_CAP) : rawCap;
  if (inWarmup) {
    notes.push(
      `warmup day ${Math.floor(daysSinceWarmup) + 1}/${e.WARMUP_DAYS} — cap=${dailyCap}`,
    );
  }

  // 3. Find due enrollments.
  const due = await db
    .select()
    .from(leadSequenceEnrollments)
    .where(
      and(
        eq(leadSequenceEnrollments.status, "active"),
        lte(leadSequenceEnrollments.nextSendAt, start),
      ) as SQL,
    )
    .orderBy(asc(leadSequenceEnrollments.nextSendAt))
    .limit(200);
  report.due = due.length;
  if (due.length === 0) return finalize(report, startMs);

  // 4. Count today's outbound (sent + draft_created) toward the cap.
  let outboundToday = await countOutboundLast24h(start);

  const provider = opts.providerFor(operatorUser.id);

  // 5. Process each enrollment in order.
  for (const enrollment of due) {
    if (outboundToday >= dailyCap) {
      report.skippedCapped++;
      // Don't advance the enrollment; leave it for the next tick.
      continue;
    }

    const outcome = await processOne({
      enrollment,
      provider,
      operatorUserId: operatorUser.id,
      settings: {
        senderName: config.senderName,
        senderEmail: config.senderEmail,
        senderTitle: config.senderTitle,
        senderPhone: config.senderPhone,
        businessName: config.businessName,
        businessAddress: config.businessAddress,
        businessMc: config.businessMc,
        businessUsdot: config.businessUsdot,
      },
      now: start,
    });

    switch (outcome.kind) {
      case "drafted":
        report.drafted++;
        outboundToday++;
        break;
      case "sent":
        report.sent++;
        outboundToday++;
        break;
      case "completed":
        report.completed++;
        break;
      case "paused":
        report.paused++;
        break;
      case "skipped_suppressed":
        report.skippedSuppressed++;
        break;
      case "skipped_no_email":
        report.skippedNoEmail++;
        break;
      case "skipped_invalid_email":
        report.skippedInvalidEmail++;
        break;
      case "failed":
        report.failed++;
        notes.push(`enrollment ${enrollment.id}: ${outcome.error}`);
        break;
    }
  }

  return finalize(report, startMs);
}

/* ─── Helpers ───────────────────────────────────────────────── */

function finalize(r: TickReport, startMs: number): TickReport {
  r.finishedAt = new Date().toISOString();
  r.durationMs = Date.now() - startMs;
  return r;
}

async function findOperatorUser(): Promise<{ id: string } | null> {
  const candidates = await db
    .select({ id: users.id })
    .from(users)
    .orderBy(asc(users.createdAt))
    .limit(20);
  // When Resend is active, any user works (no per-user OAuth needed).
  if (isResendActive()) return candidates[0] ?? null;
  for (const u of candidates) {
    if (await userHasGoogleConnection(u.id)) return u;
  }
  return null;
}

async function countOutboundLast24h(now: Date): Promise<number> {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(emailEvents)
    .where(
      and(
        sql`${emailEvents.eventType} IN ('sent', 'draft_created')`,
        sql`${emailEvents.occurredAt} >= ${since.toISOString()}`,
      ) as SQL,
    );
  return count ?? 0;
}

type ProcessOneInput = {
  enrollment: typeof leadSequenceEnrollments.$inferSelect;
  provider: EmailProvider;
  operatorUserId: string;
  settings: {
    senderName: string;
    senderEmail: string;
    senderTitle: string | null;
    senderPhone: string | null;
    businessName: string;
    businessAddress: string;
    businessMc: string | null;
    businessUsdot: string | null;
  };
  now: Date;
};

type Outcome =
  | { kind: "drafted" | "sent" | "completed" | "paused" }
  | { kind: "skipped_suppressed" | "skipped_no_email" | "skipped_invalid_email" }
  | { kind: "failed"; error: string };

async function processOne(input: ProcessOneInput): Promise<Outcome> {
  const { enrollment, provider, settings, now } = input;

  // Load the lead.
  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, enrollment.leadId))
    .limit(1);
  if (!lead) {
    await pauseEnrollment(enrollment.id, "lead_missing");
    return { kind: "paused" };
  }
  if (lead.archivedAt) {
    await pauseEnrollment(enrollment.id, "lead_archived");
    return { kind: "paused" };
  }
  if (!lead.email) {
    // No email — leave enrollment active (user may add email later); but skip this tick.
    return { kind: "skipped_no_email" };
  }

  // Suppression — definitive stop. Case-insensitive so foo@Bar.com and
  // foo@bar.com are treated as the same address.
  const [supp] = await db
    .select({ email: suppressionList.email })
    .from(suppressionList)
    .where(sql`lower(${suppressionList.email}) = lower(${lead.email})`)
    .limit(1);
  if (supp) {
    await stopEnrollment(enrollment.id, "suppressed");
    return { kind: "skipped_suppressed" };
  }

  // Per-send MX safety net. The bulk validator (one-shot + weekly cron)
  // hard-deletes leads whose MX records fail, but DNS records drift —
  // a domain might pass last week and fail today. Validate right before
  // we send so we never attempt delivery to a no_mx / disposable / role-
  // on-no-MX address. Log the failure to emailEvents for traceability;
  // pause the enrollment so the operator can fix or remove the lead.
  const { validateEmail } = await import("@/lib/research/mx-validate");
  const mxCheck = await validateEmail(lead.email);
  if (mxCheck.confidence === "rejected") {
    await db.insert(emailEvents).values({
      leadId: lead.id,
      enrollmentId: enrollment.id,
      eventType: "failed",
      templateId: null,
      sequenceStep: enrollment.currentStep,
      metadataJson: {
        kind: "invalid_email",
        mxStatus: mxCheck.status,
        domain: mxCheck.domain,
      },
      occurredAt: sql`now()`,
    });
    await pauseEnrollment(enrollment.id, "invalid_email");
    return { kind: "skipped_invalid_email" };
  }

  // Resolve the template for the current step.
  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(
      and(
        eq(emailTemplates.sequenceId, enrollment.sequenceId),
        eq(emailTemplates.sequenceStep, enrollment.currentStep),
        eq(emailTemplates.isActive, true),
      ),
    )
    .limit(1);
  if (!template) {
    // No template at this step — assume the sequence is done.
    await db
      .update(leadSequenceEnrollments)
      .set({ status: "completed", updatedAt: sql`now()` })
      .where(eq(leadSequenceEnrollments.id, enrollment.id));
    return { kind: "completed" };
  }

  // Idempotency: if a queued event already exists for this enrollment+step,
  // a previous tick attempted this — bail out.
  const [existingQueued] = await db
    .select({ id: emailEvents.id })
    .from(emailEvents)
    .where(
      and(
        eq(emailEvents.enrollmentId, enrollment.id),
        eq(emailEvents.sequenceStep, enrollment.currentStep),
        eq(emailEvents.eventType, "queued"),
      ),
    )
    .limit(1);
  let eventId = existingQueued?.id;
  if (!eventId) {
    const [queued] = await db
      .insert(emailEvents)
      .values({
        leadId: lead.id,
        enrollmentId: enrollment.id,
        eventType: "queued",
        templateId: template.id,
        sequenceStep: enrollment.currentStep,
        metadataJson: { mode: template.sendMode, source: "tick" },
        occurredAt: sql`now()`,
      })
      .returning({ id: emailEvents.id });
    eventId = queued.id;
  }

  // Build the message.
  const composed = composeEmail({
    eventId,
    lead: {
      id: lead.id,
      firstName: lead.firstName,
      lastName: lead.lastName,
      companyName: lead.companyName,
      city: lead.city,
      state: lead.state,
      vertical: lead.vertical,
    },
    subject: template.subject,
    bodyHtml: template.bodyHtml,
    bodyText: template.bodyText,
    settings,
  });

  const fromMailbox = `"${settings.senderName.replace(/"/g, '\\"')}" <${settings.senderEmail}>`;

  try {
    const result =
      template.sendMode === "auto_send"
        ? await provider.send({
            from: fromMailbox,
            to: lead.email,
            subject: composed.subject,
            html: composed.html,
            text: composed.text,
            headers: composed.headers,
            threadId: enrollment.gmailThreadId ?? undefined,
          })
        : await provider.createDraft({
            from: fromMailbox,
            to: lead.email,
            subject: composed.subject,
            html: composed.html,
            text: composed.text,
            headers: composed.headers,
            threadId: enrollment.gmailThreadId ?? undefined,
          });

    // Record success event. Tag with the actual provider that
    // shipped the email so operators can verify in /admin Health
    // (and so the audit log shows which channel actually
    // delivered each row, vs. the silent "I sent it but Resend
    // says zero" confusion). Provider is derived from the env at
    // the time of send — same source `getEmailProvider` reads.
    const providerKind: "resend" | "gmail" = env().RESEND_API_KEY
      ? "resend"
      : "gmail";
    await db.insert(emailEvents).values({
      leadId: lead.id,
      enrollmentId: enrollment.id,
      eventType: template.sendMode === "auto_send" ? "sent" : "draft_created",
      templateId: template.id,
      sequenceStep: enrollment.currentStep,
      providerMessageId: result.providerMessageId,
      metadataJson: {
        threadId: result.threadId,
        draftId: result.draftId ?? null,
        provider: providerKind,
      },
      occurredAt: sql`now()`,
    });

    // Persist the thread id for follow-up steps.
    await db
      .update(leadSequenceEnrollments)
      .set({ gmailThreadId: result.threadId, updatedAt: sql`now()` })
      .where(eq(leadSequenceEnrollments.id, enrollment.id));

    if (template.sendMode === "auto_send") {
      // Move stage new -> contacted on first send so the lead drops out of
      // the /leads worklist and the operator picks up the conversation in
      // /inbox instead. Guarded so we never downgrade replied / won / lost.
      await db
        .update(leads)
        .set({
          lastContactedAt: sql`now()`,
          stage: sql`CASE WHEN ${leads.stage} = 'new' THEN 'contacted'::stage ELSE ${leads.stage} END`,
          updatedAt: sql`now()`,
        })
        .where(eq(leads.id, lead.id));
    }

    // Advance step.
    await advanceEnrollment(enrollment, now);

    return { kind: template.sendMode === "auto_send" ? "sent" : "drafted" };
  } catch (err) {
    const errorMsg = (err as Error).message;
    await db.insert(emailEvents).values({
      leadId: lead.id,
      enrollmentId: enrollment.id,
      eventType: "failed",
      templateId: template.id,
      sequenceStep: enrollment.currentStep,
      metadataJson: {
        error: errorMsg,
        kind:
          err instanceof ProviderAuthError
            ? "auth"
            : err instanceof ProviderRateLimitError
              ? "rate_limit"
              : "other",
      },
      occurredAt: sql`now()`,
    });
    if (err instanceof ProviderAuthError) {
      await pauseEnrollment(enrollment.id, "provider_auth");
    }
    return { kind: "failed", error: errorMsg };
  }
}

async function advanceEnrollment(
  enrollment: typeof leadSequenceEnrollments.$inferSelect,
  now: Date,
) {
  // Find the next active step's template (the one whose sequence_step > current).
  const [next] = await db
    .select({ step: emailTemplates.sequenceStep })
    .from(emailTemplates)
    .where(
      and(
        eq(emailTemplates.sequenceId, enrollment.sequenceId),
        eq(emailTemplates.isActive, true),
        sql`${emailTemplates.sequenceStep} > ${enrollment.currentStep}`,
      ),
    )
    .orderBy(asc(emailTemplates.sequenceStep))
    .limit(1);

  if (!next || next.step == null) {
    await db
      .update(leadSequenceEnrollments)
      .set({ status: "completed", updatedAt: sql`now()` })
      .where(eq(leadSequenceEnrollments.id, enrollment.id));
    return;
  }

  // Compute the delay between current and next step from email_sequences.steps JSON.
  const seqRes = await db.execute<{ steps: unknown }>(
    sql`SELECT steps FROM email_sequences WHERE id = ${enrollment.sequenceId} LIMIT 1`,
  );
  const stepsRow = (seqRes as unknown as Array<{ steps: unknown }>)[0];
  const stepsArr = Array.isArray(stepsRow?.steps)
    ? (stepsRow.steps as Array<{ step: number; delayDays: number }>)
    : [];
  const stepConfig = stepsArr.find((s) => s.step === next.step);
  const delayDays = stepConfig?.delayDays ?? 4; // sane fallback

  const nextSendAt = new Date(now.getTime() + delayDays * 24 * 60 * 60 * 1000);
  await db
    .update(leadSequenceEnrollments)
    .set({
      currentStep: next.step,
      nextSendAt,
      updatedAt: sql`now()`,
    })
    .where(eq(leadSequenceEnrollments.id, enrollment.id));
}

async function pauseEnrollment(enrollmentId: string, reason: string) {
  await db
    .update(leadSequenceEnrollments)
    .set({ status: "paused", pausedReason: reason, updatedAt: sql`now()` })
    .where(eq(leadSequenceEnrollments.id, enrollmentId));
}

async function stopEnrollment(enrollmentId: string, reason: string) {
  await db
    .update(leadSequenceEnrollments)
    .set({ status: "stopped", pausedReason: reason, updatedAt: sql`now()` })
    .where(eq(leadSequenceEnrollments.id, enrollmentId));
}

/** Default provider factory used by the cron route in production. */
export function defaultProviderFor(userId: string): EmailProvider {
  return getEmailProvider(userId);
}
