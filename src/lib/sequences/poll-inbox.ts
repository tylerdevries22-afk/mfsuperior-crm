import { and, asc, eq, isNotNull, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  emailEvents,
  leadSequenceEnrollments,
  leads,
  settings as settingsTable,
  suppressionList,
  users,
} from "@/lib/db/schema";
import {
  ProviderAuthError,
  ProviderRateLimitError,
  type EmailProvider,
} from "@/lib/email/provider";
import { getEmailProvider, isResendActive } from "@/lib/email/get-provider";
import { userHasGoogleConnection } from "@/lib/gmail/oauth";
import { classifyMessage } from "@/lib/gmail/inbox-helpers";

export type InboxPollReport = {
  startedAt: string;
  finishedAt: string;
  threadsChecked: number;
  repliesFound: number;
  bouncesFound: number;
  alreadyHandled: number;
  errors: number;
  durationMs: number;
  notes: string[];
};

type PollOptions = {
  providerFor: (userId: string) => EmailProvider;
  now?: Date;
  /** Cap how many threads we look at per tick (Gmail API quota guard). */
  maxThreads?: number;
};

const DEFAULT_MAX = 100;

export async function pollInbox(opts: PollOptions): Promise<InboxPollReport> {
  const start = opts.now ?? new Date();
  const startMs = start.getTime();
  const notes: string[] = [];
  const report: InboxPollReport = {
    startedAt: start.toISOString(),
    finishedAt: start.toISOString(),
    threadsChecked: 0,
    repliesFound: 0,
    bouncesFound: 0,
    alreadyHandled: 0,
    errors: 0,
    durationMs: 0,
    notes,
  };

  const operator = await findOperatorUser();
  if (!operator) {
    notes.push("no operator user with Google connection");
    return finalize(report, startMs);
  }

  const [config] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.id, 1));
  if (!config) {
    notes.push("settings row missing — open /settings and save");
    return finalize(report, startMs);
  }
  const operatorEmail = config.senderEmail;

  // Threads to check: every active or recently-paused enrollment with a
  // gmail_thread_id, recent updatedAt first.
  const threadsToCheck = await db
    .select({
      enrollmentId: leadSequenceEnrollments.id,
      leadId: leadSequenceEnrollments.leadId,
      sequenceStep: leadSequenceEnrollments.currentStep,
      threadId: leadSequenceEnrollments.gmailThreadId,
      status: leadSequenceEnrollments.status,
      pausedReason: leadSequenceEnrollments.pausedReason,
      email: leads.email,
    })
    .from(leadSequenceEnrollments)
    .innerJoin(leads, eq(leads.id, leadSequenceEnrollments.leadId))
    .where(
      and(
        isNotNull(leadSequenceEnrollments.gmailThreadId),
        sql`${leadSequenceEnrollments.status} IN ('active', 'paused')`,
      ) as SQL,
    )
    .orderBy(asc(leadSequenceEnrollments.updatedAt))
    .limit(opts.maxThreads ?? DEFAULT_MAX);

  if (threadsToCheck.length === 0) {
    notes.push("no enrollments with gmail_thread_id to poll");
    return finalize(report, startMs);
  }

  const provider = opts.providerFor(operator.id);

  for (const t of threadsToCheck) {
    if (!t.threadId) continue;
    report.threadsChecked++;

    let thread;
    try {
      thread = await provider.getThreadMessages(t.threadId);
    } catch (err) {
      report.errors++;
      if (err instanceof ProviderAuthError) {
        notes.push(`auth error on thread ${t.threadId} — stopping poll`);
        break;
      }
      if (err instanceof ProviderRateLimitError) {
        notes.push(
          `rate-limited on thread ${t.threadId} — stopping poll for this run`,
        );
        break;
      }
      notes.push(`thread ${t.threadId}: ${(err as Error).message}`);
      continue;
    }

    // Classify each message that is NOT from us.
    let reply: { from: string; subject: string; internalDate: number } | null = null;
    let bounce: { from: string; subject: string; internalDate: number } | null = null;
    for (const m of thread) {
      const kind = classifyMessage(m.from, m.subject, operatorEmail);
      if (kind === "reply" && !reply) reply = m;
      if (kind === "bounce" && !bounce) bounce = m;
    }

    // Bounce takes precedence — it's a hard signal that the address is bad.
    if (bounce) {
      const handled = await recordBounce({
        enrollmentId: t.enrollmentId,
        leadId: t.leadId,
        leadEmail: t.email,
        sequenceStep: t.sequenceStep,
        bounceFrom: bounce.from,
        bounceSubject: bounce.subject,
      });
      if (handled === "new") report.bouncesFound++;
      else report.alreadyHandled++;
      continue;
    }

    if (reply) {
      const handled = await recordReply({
        enrollmentId: t.enrollmentId,
        leadId: t.leadId,
        sequenceStep: t.sequenceStep,
        replyFrom: reply.from,
        replySubject: reply.subject,
      });
      if (handled === "new") report.repliesFound++;
      else report.alreadyHandled++;
    }
  }

  return finalize(report, startMs);
}

function finalize(r: InboxPollReport, startMs: number): InboxPollReport {
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
  if (isResendActive()) return candidates[0] ?? null;
  for (const u of candidates) {
    if (await userHasGoogleConnection(u.id)) return u;
  }
  return null;
}

async function recordReply(input: {
  enrollmentId: string;
  leadId: string;
  sequenceStep: number;
  replyFrom: string;
  replySubject: string;
}): Promise<"new" | "duplicate"> {
  // Idempotency: skip if a `replied` event already exists for this
  // (enrollment, step) pair. Drizzle's onConflictDoNothing on the unique
  // index would also work, but explicit lookup keeps the report accurate.
  const [existing] = await db
    .select({ id: emailEvents.id })
    .from(emailEvents)
    .where(
      and(
        eq(emailEvents.enrollmentId, input.enrollmentId),
        eq(emailEvents.sequenceStep, input.sequenceStep),
        eq(emailEvents.eventType, "replied"),
      ),
    )
    .limit(1);
  if (existing) return "duplicate";

  await db.insert(emailEvents).values({
    leadId: input.leadId,
    enrollmentId: input.enrollmentId,
    eventType: "replied",
    sequenceStep: input.sequenceStep,
    metadataJson: { from: input.replyFrom, subject: input.replySubject },
    occurredAt: sql`now()`,
  });

  // Pause future steps in this sequence.
  await db
    .update(leadSequenceEnrollments)
    .set({
      status: "paused",
      pausedReason: "replied",
      updatedAt: sql`now()`,
    })
    .where(eq(leadSequenceEnrollments.id, input.enrollmentId));

  // Move the lead's pipeline forward.
  await db
    .update(leads)
    .set({
      stage: "replied",
      lastContactedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(eq(leads.id, input.leadId));

  return "new";
}

async function recordBounce(input: {
  enrollmentId: string;
  leadId: string;
  leadEmail: string | null;
  sequenceStep: number;
  bounceFrom: string;
  bounceSubject: string;
}): Promise<"new" | "duplicate"> {
  const [existing] = await db
    .select({ id: emailEvents.id })
    .from(emailEvents)
    .where(
      and(
        eq(emailEvents.enrollmentId, input.enrollmentId),
        eq(emailEvents.sequenceStep, input.sequenceStep),
        eq(emailEvents.eventType, "bounced"),
      ),
    )
    .limit(1);
  if (existing) return "duplicate";

  await db.insert(emailEvents).values({
    leadId: input.leadId,
    enrollmentId: input.enrollmentId,
    eventType: "bounced",
    sequenceStep: input.sequenceStep,
    metadataJson: { from: input.bounceFrom, subject: input.bounceSubject },
    occurredAt: sql`now()`,
  });

  // Stop the enrollment outright. Pausing isn't enough — the address is bad.
  await db
    .update(leadSequenceEnrollments)
    .set({
      status: "stopped",
      pausedReason: "bounced",
      updatedAt: sql`now()`,
    })
    .where(eq(leadSequenceEnrollments.id, input.enrollmentId));

  if (input.leadEmail) {
    await db
      .insert(suppressionList)
      .values({
        email: input.leadEmail,
        reason: "bounced",
        notes: input.bounceSubject,
      })
      .onConflictDoNothing();
  }

  return "new";
}

/** Default provider factory for the cron route. */
export function defaultPollProviderFor(userId: string): EmailProvider {
  return getEmailProvider(userId);
}
