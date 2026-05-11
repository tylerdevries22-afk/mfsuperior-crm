import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { tickSequences } from "../../src/lib/sequences/tick";
import { db } from "../../src/lib/db/client";
import {
  emailSequences,
  emailTemplates,
  leadSequenceEnrollments,
  leads,
  settings,
  users,
} from "../../src/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import type { EmailProvider, ProviderResult } from "../../src/lib/email/provider";

// Mock env — must include DATABASE_URL so db/client.ts can connect
vi.mock("../../src/lib/env", () => ({
  env: () => ({
    DATABASE_URL: process.env.DATABASE_URL ?? "",
    APP_URL: "http://localhost:3000",
    RESEND_API_KEY: "re_test",
    AUTH_SECRET: "x".repeat(32),
    AUTH_GOOGLE_ID: "id",
    AUTH_GOOGLE_SECRET: "secret",
    CRON_SECRET: "x".repeat(16),
    ENCRYPTION_KEY: "x".repeat(32),
    BUSINESS_NAME: "MF Superior Solutions",
    BUSINESS_ADDRESS: "15321 E Louisiana Ave",
    DAILY_SEND_CAP: 20,
    WARMUP_DAYS: 0, // no warmup for tests
    WARMUP_DAILY_CAP: 5,
    NODE_ENV: "test",
  }),
}));

// Mock the gmail oauth check so isResendActive path is taken
vi.mock("../../src/lib/gmail/oauth", () => ({
  userHasGoogleConnection: async () => false,
}));

const MOCK_SEND_RESULT: ProviderResult = {
  providerMessageId: "msg_test_123",
  threadId: "thread_test_123",
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function makeMockProvider(_mode: "send" | "draft" = "send"): EmailProvider {
  return {
    name: "resend",
    send: vi.fn().mockResolvedValue(MOCK_SEND_RESULT),
    createDraft: vi.fn().mockResolvedValue(MOCK_SEND_RESULT),
    getThreadMessages: vi.fn().mockResolvedValue([]),
  };
}

// We need a user, settings, sequence, template, lead, and enrollment in the DB.
// These tests hit the real DB (test isolation via cleanup in afterEach).

const TEST_TAG = `tick_test_${Date.now()}`;

async function seedTickFixtures() {
  // User
  const [user] = await db
    .insert(users)
    .values({ email: `test-${TEST_TAG}@example.com`, name: "Test User", emailVerified: sql`now()` })
    .returning({ id: users.id });

  // Settings
  await db
    .insert(settings)
    .values({
      id: 1 as const,
      businessName: "MF Superior Solutions",
      businessAddress: "15321 E Louisiana Ave, Aurora, CO 80017",
      senderName: "Tyler Devries",
      senderEmail: "info@mfsuperiorproducts.com",
      dailySendCap: 20,
      updatedAt: sql`now()`,
    })
    .onConflictDoUpdate({
      target: settings.id,
      set: {
        senderName: "Tyler Devries",
        senderEmail: "info@mfsuperiorproducts.com",
        updatedAt: sql`now()`,
      },
    });

  // Sequence
  const [seq] = await db
    .insert(emailSequences)
    .values({ name: `Test Seq ${TEST_TAG}`, status: "active", steps: [{ step: 1, delayDays: 0 }] })
    .returning({ id: emailSequences.id });

  // Template
  const [tmpl] = await db
    .insert(emailTemplates)
    .values({
      sequenceId: seq.id,
      name: "Test Day 0",
      subject: "Hi {{first_name}} from test",
      bodyHtml: "<p>Hi {{first_name}}, this is a test.</p>",
      bodyText: "Hi {{first_name}}, this is a test.",
      sequenceStep: 1,
      isActive: true,
      sendMode: "auto_send",
    })
    .returning({ id: emailTemplates.id });

  // Lead
  const [lead] = await db
    .insert(leads)
    .values({
      email: `lead-${TEST_TAG}@example.com`,
      firstName: "Bob",
      lastName: "Test",
      companyName: `Test Corp ${TEST_TAG}`,
      source: "test",
      tags: [],
    })
    .returning({ id: leads.id });

  // Enrollment due now
  const [enrollment] = await db
    .insert(leadSequenceEnrollments)
    .values({
      leadId: lead.id,
      sequenceId: seq.id,
      currentStep: 1,
      status: "active",
      nextSendAt: sql`now() - interval '1 minute'`,
    })
    .returning({ id: leadSequenceEnrollments.id });

  return { userId: user.id, seqId: seq.id, tmplId: tmpl.id, leadId: lead.id, enrollmentId: enrollment.id };
}

async function cleanupTickFixtures(ids: {
  userId: string;
  seqId: string;
  leadId: string;
  enrollmentId: string;
}) {
  await db.delete(leadSequenceEnrollments).where(eq(leadSequenceEnrollments.id, ids.enrollmentId));
  await db.delete(emailTemplates).where(eq(emailTemplates.sequenceId, ids.seqId));
  await db.delete(emailSequences).where(eq(emailSequences.id, ids.seqId));
  await db.delete(leads).where(eq(leads.id, ids.leadId));
  await db.delete(users).where(eq(users.id, ids.userId));
}

// These tests require a running Postgres on localhost:5432. CI and the
// sandbox don't have one. To run locally:
//   docker run -p 5432:5432 -e POSTGRES_PASSWORD=test postgres:16
//   DATABASE_URL=postgres://postgres:test@localhost:5432/postgres npm test
describe.skip("tickSequences (requires local Postgres)", () => {
  let fixtures: Awaited<ReturnType<typeof seedTickFixtures>>;

  beforeEach(async () => {
    fixtures = await seedTickFixtures();
  });

  afterEach(async () => {
    await cleanupTickFixtures(fixtures);
  });

  it("sends one email when a due enrollment exists", async () => {
    const provider = makeMockProvider("send");
    const report = await tickSequences({
      providerFor: () => provider,
      now: new Date(),
    });

    expect(report.sent).toBe(1);
    expect(report.failed).toBe(0);
    expect(provider.send).toHaveBeenCalledOnce();
  });

  it("advances the enrollment to completed when there are no more steps", async () => {
    const provider = makeMockProvider("send");
    await tickSequences({ providerFor: () => provider, now: new Date() });

    const [enrollment] = await db
      .select({ status: leadSequenceEnrollments.status })
      .from(leadSequenceEnrollments)
      .where(eq(leadSequenceEnrollments.id, fixtures.enrollmentId));

    expect(enrollment.status).toBe("completed");
  });

  it("skips enrollment when daily cap is 0", async () => {
    const provider = makeMockProvider();
    const report = await tickSequences({
      providerFor: () => provider,
      now: new Date(),
      dailyCapOverride: 0,
    });

    expect(report.sent).toBe(0);
    expect(report.skippedCapped).toBe(1);
  });

  it("is idempotent — second tick does nothing", async () => {
    const provider = makeMockProvider();
    await tickSequences({ providerFor: () => provider, now: new Date() });

    // Run again — enrollment is now completed, nothing due
    const report2 = await tickSequences({ providerFor: () => provider, now: new Date() });
    expect(report2.due).toBe(0);
    expect(report2.sent).toBe(0);
  });
});
