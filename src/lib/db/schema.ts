import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
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
import {
  carriers,
  drivers,
  organizations,
  shipments,
  vehicles,
} from "./target-carrier-schema";

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

export const appRoleEnum = pgEnum("app_role", [
  "admin",
  "driver",
  "customer",
]);

export const membershipStatusEnum = pgEnum("membership_status", [
  "invited",
  "pending",
  "active",
  "suspended",
  "revoked",
]);

export const customerAccessRequestStatusEnum = pgEnum(
  "customer_access_request_status",
  ["pending", "approved", "rejected", "cancelled"],
);

export const freightRequestTypeEnum = pgEnum("freight_request_type", [
  "quote",
  "pickup",
  "delivery",
  "exception",
]);

export const freightRequestStatusEnum = pgEnum("freight_request_status", [
  "draft",
  "submitted",
  "reviewing",
  "quoted",
  "booked",
  "declined",
  "cancelled",
]);

export const integrationStatusEnum = pgEnum("integration_status", [
  "not_configured",
  "connected",
  "degraded",
  "disabled",
]);

export const outboxStatusEnum = pgEnum("outbox_status", [
  "pending",
  "processing",
  "delivered",
  "failed",
]);

export const documentStatusEnum = pgEnum("document_status", [
  "pending_upload",
  "uploaded",
  "verified",
  "rejected",
  "deleted",
]);

/* ───── Auth (Auth.js Drizzle adapter shape) ─────────────────── */

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** Cryptographically verified Supabase JWT `sub`; never sourced from metadata. */
  authSubject: text("auth_subject").unique(),
  authProvider: varchar("auth_provider", { length: 40 }),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/* ───── Multi-tenant identity + freight foundation ───────────── */

export const customerAccounts = pgTable(
  "customer_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    companyName: varchar("company_name", { length: 200 }).notNull(),
    contactEmail: text("contact_email"),
    contactPhone: varchar("contact_phone", { length: 50 }),
    externalReference: varchar("external_reference", { length: 120 }),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("customer_accounts_org_idx").on(table.organizationId),
    uniqueIndex("customer_accounts_org_external_unique")
      .on(table.organizationId, table.externalReference)
      .where(sql`${table.externalReference} is not null`),
  ],
);

export const organizationMemberships = pgTable(
  "organization_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: appRoleEnum("role").notNull(),
    status: membershipStatusEnum("status").notNull().default("active"),
    driverId: uuid("driver_id").references(() => drivers.id, {
      onDelete: "set null",
    }),
    customerAccountId: uuid("customer_account_id").references(
      () => customerAccounts.id,
      { onDelete: "set null" },
    ),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("organization_memberships_org_user_unique").on(
      table.organizationId,
      table.userId,
    ),
    index("organization_memberships_user_status_idx").on(
      table.userId,
      table.status,
    ),
    uniqueIndex("organization_memberships_default_user_unique")
      .on(table.userId)
      .where(sql`${table.isDefault} = true and ${table.status} = 'active'`),
  ],
);

export const organizationInvitations = pgTable(
  "organization_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    role: appRoleEnum("role").notNull(),
    driverId: uuid("driver_id").references(() => drivers.id, {
      onDelete: "set null",
    }),
    customerAccountId: uuid("customer_account_id").references(
      () => customerAccounts.id,
      { onDelete: "set null" },
    ),
    invitedByUserId: uuid("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("organization_invitations_org_email_idx").on(
      table.organizationId,
      table.email,
    ),
  ],
);

export const customerAccessRequests = pgTable(
  "customer_access_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => organizationMemberships.id, { onDelete: "cascade" }),
    status: customerAccessRequestStatusEnum("status")
      .notNull()
      .default("pending"),
    requestedCompanyName: varchar("requested_company_name", { length: 200 }),
    linkedCustomerAccountId: uuid("linked_customer_account_id").references(
      () => customerAccounts.id,
      { onDelete: "set null" },
    ),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewNotes: text("review_notes"),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("customer_access_requests_org_user_unique").on(
      table.organizationId,
      table.userId,
    ),
    uniqueIndex("customer_access_requests_membership_unique").on(
      table.membershipId,
    ),
    index("customer_access_requests_org_status_idx").on(
      table.organizationId,
      table.status,
      table.requestedAt,
    ),
  ],
);

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

/* ───── Quick-add backlog ─────────────────────────────────────
 *
 * Pre-verified lead candidates the Quick-add button can drain
 * INSTANTLY. Without this table the action ran the website-scrape
 * + Hunter pipeline INLINE for every click — ~30-60s per click —
 * so operators perceived the button as broken ("nothing happens").
 *
 * Flow:
 *   1. Operator clicks Quick-add. Server action SELECTs ≤N rows
 *      from this table, bulk-inserts them as leads (skip on
 *      conflict), DELETEs the consumed rows. Sub-second response.
 *   2. Next.js `after()` defers a refill that runs the slow
 *      verify pipeline AFTER the redirect is sent — operator
 *      sees the leads immediately while the next batch warms.
 *
 * Rows are deleted on consumption. The table never grows large
 * (~50-100 rows steady-state).
 */
export const quickAddBacklog = pgTable("quick_add_backlog", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  companyName: text("company_name").notNull(),
  website: text("website"),
  industry: varchar("industry", { length: 60 }),
  /** Human-readable vertical label (e.g. "Restaurant", "Big-box retail"). */
  vertical: text("vertical"),
  refrigerated: boolean("refrigerated").notNull().default(false),
  chain: boolean("chain").notNull().default(false),
  /** Which verification path resolved this email — "website-scrape" or "hunter-search". */
  source: varchar("source", { length: 32 }).notNull(),
  /** Notes that get copied onto the inserted lead. */
  sourceNote: text("source_note"),
  verifiedAt: timestamp("verified_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (t) => [
  // Idempotency: re-verifying the same email shouldn't add a
  // second backlog entry. The refill helper uses onConflictDoNothing
  // against this.
  uniqueIndex("quick_add_backlog_email_unique").on(t.email),
]);

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

/* ───── Tenant-scoped freight data + mobile synchronization ─── */

export const freightLocations = pgTable(
  "freight_locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    externalReference: varchar("external_reference", { length: 120 }),
    name: varchar("name", { length: 200 }).notNull(),
    kind: varchar("kind", { length: 40 }).notNull().default("other"),
    addressLine1: varchar("address_line_1", { length: 200 }).notNull(),
    addressLine2: varchar("address_line_2", { length: 200 }),
    city: varchar("city", { length: 100 }).notNull(),
    state: varchar("state", { length: 50 }).notNull(),
    postalCode: varchar("postal_code", { length: 20 }).notNull(),
    countryCode: varchar("country_code", { length: 2 })
      .notNull()
      .default("US"),
    latitude: varchar("latitude", { length: 30 }),
    longitude: varchar("longitude", { length: 30 }),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("freight_locations_org_name_idx").on(
      table.organizationId,
      table.name,
    ),
    uniqueIndex("freight_locations_org_external_unique")
      .on(table.organizationId, table.externalReference)
      .where(sql`${table.externalReference} is not null`),
    check(
      "freight_locations_kind_check",
      sql`${table.kind} in ('pickup', 'delivery', 'terminal', 'customer', 'other')`,
    ),
  ],
);

export const freightRequests = pgTable(
  "freight_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    customerAccountId: uuid("customer_account_id").references(
      () => customerAccounts.id,
      { onDelete: "set null" },
    ),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    shipmentId: uuid("shipment_id").references(() => shipments.id, {
      onDelete: "set null",
    }),
    referenceNumber: varchar("reference_number", { length: 120 }),
    subject: varchar("subject", { length: 200 }),
    requestType: freightRequestTypeEnum("request_type").notNull().default("quote"),
    status: freightRequestStatusEnum("status").notNull().default("submitted"),
    origin: jsonb("origin").notNull(),
    destination: jsonb("destination").notNull(),
    pickupWindowStart: timestamp("pickup_window_start", { withTimezone: true }),
    pickupWindowEnd: timestamp("pickup_window_end", { withTimezone: true }),
    deliveryWindowStart: timestamp("delivery_window_start", {
      withTimezone: true,
    }),
    deliveryWindowEnd: timestamp("delivery_window_end", {
      withTimezone: true,
    }),
    commodity: varchar("commodity", { length: 200 }),
    weightLbs: integer("weight_lbs"),
    palletCount: integer("pallet_count"),
    equipmentType: varchar("equipment_type", { length: 50 }),
    notes: text("notes"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("freight_requests_org_status_created_idx").on(
      table.organizationId,
      table.status,
      table.createdAt,
    ),
    index("freight_requests_customer_created_idx").on(
      table.customerAccountId,
      table.createdAt,
    ),
    uniqueIndex("freight_requests_org_reference_unique")
      .on(table.organizationId, table.referenceNumber)
      .where(sql`${table.referenceNumber} is not null`),
    check(
      "freight_requests_weight_check",
      sql`${table.weightLbs} is null or ${table.weightLbs} between 0 and 200000`,
    ),
    check(
      "freight_requests_pallet_check",
      sql`${table.palletCount} is null or ${table.palletCount} between 0 and 1000`,
    ),
  ],
);

export const customerShipmentAccess = pgTable(
  "customer_shipment_access",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    customerAccountId: uuid("customer_account_id")
      .notNull()
      .references(() => customerAccounts.id, { onDelete: "cascade" }),
    // Foreign key declared compositely with organizationId below.
    shipmentId: uuid("shipment_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.customerAccountId, table.shipmentId] }),
    index("customer_shipment_access_org_idx").on(table.organizationId),
    // A customer grant can only ever name a shipment inside its own
    // organization.
    foreignKey({
      columns: [table.shipmentId, table.organizationId],
      foreignColumns: [shipments.id, shipments.organizationId],
      name: "customer_shipment_access_shipment_organization_fk",
    }).onDelete("cascade"),
  ],
);

export const freightDocuments = pgTable(
  "freight_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    shipmentId: uuid("shipment_id").references(() => shipments.id, {
      onDelete: "set null",
    }),
    requestId: uuid("request_id").references(() => freightRequests.id, {
      onDelete: "set null",
    }),
    uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    kind: varchar("kind", { length: 50 }).notNull(),
    status: documentStatusEnum("status").notNull().default("pending_upload"),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    contentType: varchar("content_type", { length: 120 }).notNull(),
    byteSize: integer("byte_size").notNull(),
    storageBucket: varchar("storage_bucket", { length: 100 }).notNull(),
    storagePath: text("storage_path").notNull().unique(),
    checksumSha256: varchar("checksum_sha256", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("freight_documents_org_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
    index("freight_documents_shipment_idx").on(table.shipmentId),
    check(
      "freight_documents_byte_size_check",
      sql`${table.byteSize} between 1 and 20971520`,
    ),
    /**
     * A document can only ever name a shipment inside its own organization.
     * `MATCH SIMPLE` keeps request-only documents valid, and is also what
     * absorbs the null the single-column `ON DELETE SET NULL` key above
     * leaves behind; a composite `SET NULL` would try to null the
     * non-nullable organization pin instead.
     */
    foreignKey({
      columns: [table.shipmentId, table.organizationId],
      foreignColumns: [shipments.id, shipments.organizationId],
      name: "freight_documents_shipment_organization_fk",
    }).onDelete("no action"),
  ],
);

export const integrationConnections = pgTable(
  "integration_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 80 }).notNull(),
    status: integrationStatusEnum("status")
      .notNull()
      .default("not_configured"),
    externalAccountId: varchar("external_account_id", { length: 200 }),
    configuration: jsonb("configuration").notNull().default({}),
    lastSucceededAt: timestamp("last_succeeded_at", { withTimezone: true }),
    lastFailedAt: timestamp("last_failed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("integration_connections_org_provider_unique").on(
      table.organizationId,
      table.provider,
    ),
  ],
);

export const oauthConnections = pgTable(
  "oauth_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 80 }).notNull(),
    externalAccountId: varchar("external_account_id", { length: 200 }),
    encryptedAccessToken: text("encrypted_access_token"),
    encryptedRefreshToken: text("encrypted_refresh_token"),
    encryptionKeyVersion: varchar("encryption_key_version", { length: 40 })
      .notNull(),
    scopes: text("scopes").array().notNull().default([]),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("oauth_connections_org_provider_unique").on(
      table.organizationId,
      table.provider,
    ),
  ],
);

export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    topic: varchar("topic", { length: 120 }).notNull(),
    aggregateType: varchar("aggregate_type", { length: 80 }).notNull(),
    aggregateId: text("aggregate_id").notNull(),
    deduplicationKey: varchar("deduplication_key", { length: 160 }).notNull(),
    payload: jsonb("payload").notNull(),
    status: outboxStatusEnum("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastErrorCode: varchar("last_error_code", { length: 80 }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("outbox_events_org_dedup_unique").on(
      table.organizationId,
      table.deduplicationKey,
    ),
    index("outbox_events_status_next_attempt_idx").on(
      table.status,
      table.nextAttemptAt,
    ),
  ],
);

export const mobileSyncStates = pgTable(
  "mobile_sync_states",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceId: varchar("device_id", { length: 120 }).notNull(),
    cursor: text("cursor"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.userId, table.deviceId] }),
  ],
);

export const mobileMutationReceipts = pgTable(
  "mobile_mutation_receipts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    idempotencyKey: varchar("idempotency_key", { length: 120 }).notNull(),
    operation: varchar("operation", { length: 80 }).notNull(),
    requestHash: varchar("request_hash", { length: 64 }).notNull(),
    responseStatus: integer("response_status").notNull(),
    responseBody: jsonb("response_body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("mobile_mutation_receipts_actor_key_unique").on(
      table.organizationId,
      table.actorUserId,
      table.idempotencyKey,
    ),
    index("mobile_mutation_receipts_created_idx").on(table.createdAt),
  ],
);

export const documentUploadIntents = pgTable(
  "document_upload_intents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => freightDocuments.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    idempotencyKey: varchar("idempotency_key", { length: 120 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("document_upload_intents_actor_key_unique").on(
      table.organizationId,
      table.actorUserId,
      table.idempotencyKey,
    ),
  ],
);

/** Persistent fixed-window counters; keys are SHA-256 digests, never raw IDs. */
export const apiRateLimitBuckets = pgTable(
  "api_rate_limit_buckets",
  {
    keyHash: varchar("key_hash", { length: 64 }).notNull(),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true })
      .notNull(),
    requestCount: integer("request_count").notNull().default(1),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.keyHash, table.windowStartedAt] }),
    index("api_rate_limit_buckets_expires_idx").on(table.expiresAt),
    check(
      "api_rate_limit_buckets_count_check",
      sql`${table.requestCount} > 0`,
    ),
  ],
);

export const operationsMessageThreadKindEnum = pgEnum(
  "operations_message_thread_kind",
  ["shipment", "dispatch", "support"],
);

/**
 * Tenant-scoped operational messaging. Recipients are stored as membership
 * user ids so read access can be enforced without a separate join table.
 */
export const operationsMessages = pgTable(
  "operations_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    threadKey: varchar("thread_key", { length: 120 }).notNull(),
    threadKind: operationsMessageThreadKindEnum("thread_kind").notNull(),
    shipmentId: uuid("shipment_id").references(() => shipments.id, {
      onDelete: "set null",
    }),
    senderUserId: uuid("sender_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipientUserIds: jsonb("recipient_user_ids").notNull().default([]),
    body: text("body").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("operations_messages_org_thread_sent_idx").on(
      table.organizationId,
      table.threadKey,
      table.sentAt,
    ),
    index("operations_messages_org_sent_idx").on(
      table.organizationId,
      table.sentAt,
    ),
    index("operations_messages_shipment_sent_idx").on(
      table.shipmentId,
      table.sentAt,
    ),
  ],
);

export const operationsMessageReads = pgTable(
  "operations_message_reads",
  {
    messageId: uuid("message_id")
      .notNull()
      .references(() => operationsMessages.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.messageId, table.userId] }),
    index("operations_message_reads_user_idx").on(table.userId),
  ],
);

/** Immutable carrier-scoped event delivered to the driver receiving a unit. */
export const vehicleTransferEvents = pgTable(
  "vehicle_transfer_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    carrierId: uuid("carrier_id")
      .notNull()
      .references(() => carriers.id, { onDelete: "cascade" }),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    fromDriverId: uuid("from_driver_id").references(() => drivers.id, {
      onDelete: "set null",
    }),
    targetDriverId: uuid("target_driver_id")
      .notNull()
      .references(() => drivers.id, { onDelete: "cascade" }),
    /** Supabase Auth subject used only by Realtime RLS for recipient filtering. */
    targetAuthSubject: text("target_auth_subject").notNull(),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    vehicleUnitNumber: varchar("vehicle_unit_number", { length: 40 }).notNull(),
    fromDriverName: varchar("from_driver_name", { length: 200 }),
    targetDriverName: varchar("target_driver_name", { length: 200 }).notNull(),
    note: varchar("note", { length: 1_000 }).notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("vehicle_transfer_events_target_created_idx").on(
      table.targetDriverId,
      table.createdAt,
    ),
    index("vehicle_transfer_events_org_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
  ],
);

/** Expo push tokens registered by a signed-in device. */
export const mobilePushTokens = pgTable(
  "mobile_push_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expoPushToken: varchar("expo_push_token", { length: 255 }).notNull(),
    platform: varchar("platform", { length: 20 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "mobile_push_tokens_platform_check",
      sql`${table.platform} in ('ios', 'android')`,
    ),
    uniqueIndex("mobile_push_tokens_token_unique").on(table.expoPushToken),
    index("mobile_push_tokens_user_idx").on(table.organizationId, table.userId),
  ],
);

/* ───── Target Carrier / Logistics ───────────────────────────── */
export * from "./target-carrier-schema";
