import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/* ───── Enums ─────────────────────────────────────────────────── */

export const stageEnum = pgEnum("stage", [
  "new",
  "contacted",
  "replied",
  "quoted",
  "won",
  "lost",
]);

export const tierEnum = pgEnum("tier", ["A", "B", "C"]);

export const sendModeEnum = pgEnum("send_mode", ["draft", "auto_send"]);

export const enrollmentStatusEnum = pgEnum("enrollment_status", [
  "active",
  "paused",
  "completed",
  "stopped",
]);

export const eventTypeEnum = pgEnum("event_type", [
  "queued",
  "draft_created",
  "sent",
  "opened",
  "clicked",
  "replied",
  "bounced",
  "unsubscribed",
  "failed",
]);

export const suppressionReasonEnum = pgEnum("suppression_reason", [
  "unsubscribed",
  "bounced",
  "manual",
  "invalid",
  "replied",
]);

/* ───── Auth (Auth.js Drizzle adapter shape) ─────────────────── */

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/* ───── Settings (singleton row) ─────────────────────────────── */

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  businessName: text("business_name").notNull().default("MF Superior Products"),
  businessAddress: text("business_address").notNull().default(""),
  businessMc: text("business_mc"),
  businessUsdot: text("business_usdot"),
  senderName: text("sender_name").notNull().default("Tyler DeVries"),
  senderEmail: text("sender_email").notNull(),
  senderTitle: text("sender_title"),
  senderPhone: varchar("sender_phone", { length: 40 }),
  driveFolderId: text("drive_folder_id"),
  dailySendCap: integer("daily_send_cap").notNull().default(20),
  warmupStartedAt: timestamp("warmup_started_at", { withTimezone: true }),
  unsubscribeFooterHtml: text("unsubscribe_footer_html"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/* ───── Leads ─────────────────────────────────────────────────── */

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    firstName: varchar("first_name", { length: 120 }),
    lastName: varchar("last_name", { length: 120 }),
    /**
     * Nullable: the source `01_Lead_List.xlsx` does not include verified
     * decision-maker emails. The kit workflow is "phone first, then email".
     * Suppression and sequence-tick logic must skip leads where email is null.
     */
    email: text("email"),
    phone: varchar("phone", { length: 40 }),
    companyName: text("company_name"),
    website: text("website"),
    vertical: varchar("vertical", { length: 120 }),
    address: text("address"),
    city: varchar("city", { length: 120 }),
    state: varchar("state", { length: 40 }),
    source: varchar("source", { length: 80 }),
    stage: stageEnum("stage").notNull().default("new"),
    status: varchar("status", { length: 40 }).notNull().default("active"),
    tier: tierEnum("tier"),
    score: integer("score"),
    tags: text("tags").array().notNull().default([]),
    notes: text("notes"),
    driveRowId: text("drive_row_id"),
    driveFileId: text("drive_file_id"),
    driveSyncOrphan: boolean("drive_sync_orphan").notNull().default(false),
    lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
    nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    /**
     * Composite trust level for `email`, populated by
     * src/lib/leads/email-trust.ts. Mirrors the EmailTrust union:
     *   • "verified"   — confirmed by website scrape or upstream tag
     *   • "guessed"    — role-pattern address (info@/sales@), MX-only
     *   • "unverified" — passed syntax+MX, provenance unknown
     *   • "invalid"    — failed MX / syntax / disposable filter
     *   • null         — never run through the pipeline yet
     *
     * Stored as a plain text column (not an enum) so adding new
     * categories doesn't require a schema migration. The filter
     * rail + EmailTrustChip read this directly.
     */
    emailTrust: text("email_trust"),
    /**
     * Timestamp of the most recent pipeline run. Used by the weekly
     * cron to skip rows already classified inside the window.
     */
    emailValidatedAt: timestamp("email_validated_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    // Partial unique: enforce email uniqueness only when set.
    uniqueIndex("leads_email_unique")
      .on(t.email)
      .where(sql`${t.email} IS NOT NULL`),
    // Fallback dedupe key for email-less leads (companies imported from spreadsheet).
    uniqueIndex("leads_company_no_email_unique")
      .on(t.companyName)
      .where(sql`${t.email} IS NULL AND ${t.companyName} IS NOT NULL`),
    index("leads_stage_idx").on(t.stage),
    index("leads_tier_score_idx").on(t.tier, t.score),
  ],
);

/* ───── Sequences + Templates ────────────────────────────────── */

export const emailSequences = pgTable("email_sequences", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  status: varchar("status", { length: 40 }).notNull().default("active"),
  steps: jsonb("steps").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const emailTemplates = pgTable("email_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  bodyText: text("body_text").notNull(),
  sequenceId: uuid("sequence_id").references(() => emailSequences.id, {
    onDelete: "set null",
  }),
  sequenceStep: integer("sequence_step"),
  /**
   * Send mode for a template. `auto_send` actually dispatches the
   * email via the configured provider (Resend / Gmail) when the
   * sequence tick reaches this step. `draft` only creates a Gmail
   * draft for the operator to review + send manually.
   *
   * Default is `auto_send` — the whole sequence engine exists to
   * dispatch outreach automatically; defaulting to `draft` meant
   * every new template silently stopped at draft-creation and
   * never sent until the operator flipped the mode in the UI.
   * Switch back to `draft` per-template if a particular template
   * needs human review before going out.
   */
  sendMode: sendModeEnum("send_mode").notNull().default("auto_send"),
  attachmentDriveFileIds: jsonb("attachment_drive_file_ids")
    .notNull()
    .default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const leadSequenceEnrollments = pgTable(
  "lead_sequence_enrollments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    sequenceId: uuid("sequence_id")
      .notNull()
      .references(() => emailSequences.id, { onDelete: "cascade" }),
    currentStep: integer("current_step").notNull().default(0),
    status: enrollmentStatusEnum("status").notNull().default("active"),
    nextSendAt: timestamp("next_send_at", { withTimezone: true }),
    pausedReason: text("paused_reason"),
    gmailThreadId: text("gmail_thread_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("enrollment_lead_sequence_unique").on(t.leadId, t.sequenceId),
  ],
);

/* ───── Email events ─────────────────────────────────────────── */

export const emailEvents = pgTable(
  "email_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    enrollmentId: uuid("enrollment_id").references(
      () => leadSequenceEnrollments.id,
      { onDelete: "set null" },
    ),
    providerMessageId: text("provider_message_id"),
    eventType: eventTypeEnum("event_type").notNull(),
    templateId: uuid("template_id").references(() => emailTemplates.id, {
      onDelete: "set null",
    }),
    sequenceStep: integer("sequence_step"),
    metadataJson: jsonb("metadata_json").default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("email_events_idempotency").on(
      t.enrollmentId,
      t.sequenceStep,
      t.eventType,
    ),
  ],
);

export const emailClicks = pgTable("email_clicks", {
  id: uuid("id").defaultRandom().primaryKey(),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  emailEventId: uuid("email_event_id").references(() => emailEvents.id, {
    onDelete: "set null",
  }),
  url: text("url").notNull(),
  trackingId: text("tracking_id").notNull(),
  ipHash: text("ip_hash"),
  uaHash: text("ua_hash"),
  clickedAt: timestamp("clicked_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/* ───── Suppression + unsubscribe ────────────────────────────── */

export const suppressionList = pgTable("suppression_list", {
  email: text("email").primaryKey(),
  reason: suppressionReasonEnum("reason").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const unsubscribes = pgTable("unsubscribes", {
  id: uuid("id").defaultRandom().primaryKey(),
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
  email: text("email").notNull(),
  reason: text("reason"),
  source: varchar("source", { length: 40 }).notNull().default("link"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/* ───── Notes + audit + sync state ───────────────────────────── */

export const crmNotes = pgTable("crm_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  note: text("note").notNull(),
  createdBy: uuid("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorUserId: uuid("actor_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  entity: varchar("entity", { length: 80 }).notNull(),
  entityId: text("entity_id"),
  action: varchar("action", { length: 80 }).notNull(),
  beforeJson: jsonb("before_json"),
  afterJson: jsonb("after_json"),
  occurredAt: timestamp("occurred_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const driveSyncState = pgTable("drive_sync_state", {
  id: integer("id").primaryKey().default(1),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastSheetHash: text("last_sheet_hash"),
  conflictsPending: integer("conflicts_pending").notNull().default(0),
});

/* ───── Notifications ─────────────────────────────────────────── */

export const notificationTypeEnum = pgEnum("notification_type", [
  "lead_submitted",
  "email_sent",
  "email_opened",
  "email_replied",
  "sequence_completed",
]);

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
  readAt: timestamp("read_at", { withTimezone: true }),
  metadataJson: jsonb("metadata_json").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
