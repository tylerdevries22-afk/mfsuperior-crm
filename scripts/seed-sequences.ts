/**
 * Seed the Day 0/4/10 email sequence, templates, settings, dev user, and
 * a test enrollment for tylerdevries22@gmail.com.
 *
 * Safe to re-run — all inserts are idempotent.
 */

import "dotenv/config";
import { db } from "../src/lib/db/client";
import {
  emailSequences,
  emailTemplates,
  leadSequenceEnrollments,
  leads,
  settings,
  users,
} from "../src/lib/db/schema";
import { SEED_TEMPLATES, SEED_SEQUENCE_NAME } from "../src/lib/email/seed-templates";
import { eq, sql, and } from "drizzle-orm";

async function main() {
  console.log("── Seed sequences ──────────────────────────────");

  // ── 1. Ensure settings row exists with sender info ─────────────────────────
  const settingsValues = {
    id: 1 as const,
    businessName: "MF Superior Products",
    businessAddress: "15321 E Louisiana Ave, Aurora, CO 80017, United States",
    businessMc: null,
    businessUsdot: null,
    senderName: "Tyler Devries",
    senderEmail: "info@mfsuperiorproducts.com",
    senderTitle: "Owner",
    senderPhone: "(256) 468-0751",
    dailySendCap: 20,
    driveFolderId: null,
    updatedAt: sql`now()`,
  };
  await db
    .insert(settings)
    .values(settingsValues)
    .onConflictDoUpdate({ target: settings.id, set: settingsValues });
  console.log("✓ settings row upserted");

  // ── 2. Ensure dev user exists ───────────────────────────────────────────────
  const devEmail = "info@mfsuperiorproducts.com";
  let userId: string;
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, devEmail))
    .limit(1);
  if (existingUser) {
    userId = existingUser.id;
    console.log(`✓ user exists: ${userId}`);
  } else {
    const [created] = await db
      .insert(users)
      .values({ email: devEmail, name: "Tyler Devries", emailVerified: sql`now()` })
      .returning({ id: users.id });
    userId = created.id;
    console.log(`✓ user created: ${userId}`);
  }

  // ── 3. Upsert the sequence ──────────────────────────────────────────────────
  const stepsJson = SEED_TEMPLATES.map((t) => ({
    step: t.step,
    delayDays: t.delayDays,
  }));

  // Check if sequence already exists by name
  const [existingSeq] = await db
    .select({ id: emailSequences.id })
    .from(emailSequences)
    .where(eq(emailSequences.name, SEED_SEQUENCE_NAME))
    .limit(1);

  let sequenceId: string;
  if (existingSeq) {
    sequenceId = existingSeq.id;
    await db
      .update(emailSequences)
      .set({ steps: stepsJson, status: "active" })
      .where(eq(emailSequences.id, sequenceId));
    console.log(`✓ sequence updated: ${sequenceId}`);
  } else {
    const [seq] = await db
      .insert(emailSequences)
      .values({ name: SEED_SEQUENCE_NAME, status: "active", steps: stepsJson })
      .returning({ id: emailSequences.id });
    sequenceId = seq.id;
    console.log(`✓ sequence created: ${sequenceId}`);
  }

  // ── 4. Upsert templates ─────────────────────────────────────────────────────
  for (const t of SEED_TEMPLATES) {
    const [existing] = await db
      .select({ id: emailTemplates.id })
      .from(emailTemplates)
      .where(
        and(
          eq(emailTemplates.sequenceId, sequenceId),
          eq(emailTemplates.sequenceStep, t.step),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(emailTemplates)
        .set({
          name: t.name,
          subject: t.subject,
          bodyHtml: t.bodyHtml,
          bodyText: t.bodyText,
          isActive: true,
          sendMode: "auto_send",
        })
        .where(eq(emailTemplates.id, existing.id));
      console.log(`✓ template updated: step ${t.step} — ${t.name}`);
    } else {
      await db.insert(emailTemplates).values({
        sequenceId,
        name: t.name,
        subject: t.subject,
        bodyHtml: t.bodyHtml,
        bodyText: t.bodyText,
        sequenceStep: t.step,
        isActive: true,
        sendMode: "auto_send",
      });
      console.log(`✓ template created: step ${t.step} — ${t.name}`);
    }
  }

  // ── 5. Create / find test lead for tylerdevries22@gmail.com ────────────────
  const testEmail = "tylerdevries22@gmail.com";
  let testLeadId: string;
  const [existingLead] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(eq(leads.email, testEmail))
    .limit(1);

  if (existingLead) {
    testLeadId = existingLead.id;
    console.log(`✓ test lead exists: ${testLeadId}`);
  } else {
    const [created] = await db
      .insert(leads)
      .values({
        email: testEmail,
        firstName: "Tyler",
        lastName: "Devries",
        companyName: "Test Co",
        phone: "(303) 555-0100",
        source: "manual",
        stage: "new",
        tier: "A",
        notes: "Test lead for email automation verification",
        tags: [],
      })
      .returning({ id: leads.id });
    testLeadId = created.id;
    console.log(`✓ test lead created: ${testLeadId}`);
  }

  // ── 6. Enroll test lead in the sequence ────────────────────────────────────
  const [existingEnrollment] = await db
    .select({ id: leadSequenceEnrollments.id, status: leadSequenceEnrollments.status })
    .from(leadSequenceEnrollments)
    .where(
      and(
        eq(leadSequenceEnrollments.leadId, testLeadId),
        eq(leadSequenceEnrollments.sequenceId, sequenceId),
      ),
    )
    .limit(1);

  if (existingEnrollment) {
    // Re-activate if paused/stopped so we can re-test
    if (existingEnrollment.status !== "active") {
      await db
        .update(leadSequenceEnrollments)
        .set({ status: "active", currentStep: 1, nextSendAt: sql`now()`, updatedAt: sql`now()` })
        .where(eq(leadSequenceEnrollments.id, existingEnrollment.id));
      console.log(`✓ enrollment re-activated: ${existingEnrollment.id}`);
    } else {
      console.log(`✓ enrollment already active: ${existingEnrollment.id}`);
    }
  } else {
    const [enrollment] = await db
      .insert(leadSequenceEnrollments)
      .values({
        leadId: testLeadId,
        sequenceId,
        currentStep: 1,
        status: "active",
        nextSendAt: sql`now()`,
      })
      .returning({ id: leadSequenceEnrollments.id });
    console.log(`✓ test lead enrolled: ${enrollment.id}`);
  }

  console.log("\n── Done ────────────────────────────────────────");
  console.log(`Sequence ID:   ${sequenceId}`);
  console.log(`Test lead:     ${testEmail} (id: ${testLeadId})`);
  console.log(`\nRun tick to send Day 0 email:`);
  console.log(`  curl -s http://localhost:3000/api/cron/tick-sequences -X POST \\`);
  console.log(`    -H "Authorization: Bearer be99ca1751c1e30052793107fa913541f9db24a7" | python3 -m json.tool`);

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
