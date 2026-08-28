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
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/* ───── Target Carrier / Logistics ───────────────────────────── */

export const carrierStatusEnum = pgEnum("carrier_status", [
  "active",
  "inactive",
  "suspended",
]);

export const shipmentStatusEnum = pgEnum("shipment_status", [
  "tendered",
  "accepted",
  "dispatched",
  "at_pickup",
  "in_transit",
  "at_delivery",
  "delivered",
  "cancelled",
  "exception",
]);

export const driverStatusEnum = pgEnum("driver_status", [
  "available",
  "on_duty",
  "off_duty",
  "suspended",
]);

export const hosDutyStatusEnum = pgEnum("hos_duty_status", [
  "off_duty",
  "sleeper_berth",
  "driving",
  "on_duty_not_driving",
]);

export const shipmentSourceEnum = pgEnum("shipment_source", [
  "manual",
  "demo",
  "simulated",
  "edi",
  "api",
]);

export const ediDirectionEnum = pgEnum("edi_direction", [
  "inbound",
  "outbound",
]);

export const ediStatusEnum = pgEnum("edi_status", [
  "received",
  "parsed",
  "processed",
  "error",
  "acknowledged",
]);

export const geofenceTypeEnum = pgEnum("geofence_type", [
  "store",
  "distribution_center",
  "pickup",
  "delivery",
  "other",
]);

export const organizationStatusEnum = pgEnum("organization_status", [
  "active",
  "suspended",
  "archived",
]);

/**
 * Security boundary for every freight record. A carrier is the operational
 * profile attached to an organization, while membership authorization is
 * always evaluated against the organization itself.
 */
export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 80 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    status: organizationStatusEnum("status").notNull().default("active"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("organizations_status_idx").on(table.status)],
);

export const carriers = pgTable(
  "carriers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    scac: varchar("scac", { length: 10 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    dotNumber: varchar("dot_number", { length: 20 }),
    contactEmail: text("contact_email"),
    contactPhone: varchar("contact_phone", { length: 50 }),
    targetVendorId: varchar("target_vendor_id", { length: 100 }),
    ediQualifier: varchar("edi_qualifier", { length: 50 }),
    ediId: varchar("edi_id", { length: 50 }),
    status: carrierStatusEnum("status").notNull().default("active"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("carriers_status_idx").on(table.status),
    uniqueIndex("carriers_organization_unique").on(table.organizationId),
    // Composite target so a shipment can never name a carrier from another
    // organization; the pair is what child tables reference.
    unique("carriers_id_organization_unique").on(table.id, table.organizationId),
  ],
);

export const drivers = pgTable(
  "drivers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    carrierId: uuid("carrier_id")
      .notNull()
      .references(() => carriers.id, { onDelete: "cascade" }),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    email: text("email"),
    phone: varchar("phone", { length: 50 }),
    licenseNumber: varchar("license_number", { length: 100 }),
    licenseState: varchar("license_state", { length: 10 }),
    cdlType: varchar("cdl_type", { length: 20 }),
    status: driverStatusEnum("status").notNull().default("available"),
    currentLat: varchar("current_lat", { length: 30 }),
    currentLng: varchar("current_lng", { length: 30 }),
    locationUpdatedAt: timestamp("location_updated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("drivers_carrier_status_idx").on(table.carrierId, table.status),
    uniqueIndex("drivers_carrier_license_unique")
      .on(table.carrierId, table.licenseNumber)
      .where(sql`${table.licenseNumber} is not null`),
    // Composite target so a shipment can never name a driver from another
    // carrier, and therefore never from another organization.
    unique("drivers_id_carrier_unique").on(table.id, table.carrierId),
  ],
);

export const shipments = pgTable(
  "shipments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /**
     * Denormalized tenant pin. `shipmentAccessPredicate` scopes reads by
     * carrier, so the carrier/organization pair must be impossible to
     * disagree on; the composite foreign key below is what guarantees it.
     */
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    // Foreign key declared compositely with organizationId below.
    carrierId: uuid("carrier_id").notNull(),
    driverId: uuid("driver_id").references(() => drivers.id, {
      onDelete: "set null",
    }),
    /**
     * Slug from `src/data/partners.ts` — which broker / retailer program the
     * load came from. Denormalised text rather than a FK because the partner
     * directory is committed application data, not a table, and a load's
     * partner has to survive a partner being renamed or retired.
     */
    partnerSlug: varchar("partner_slug", { length: 64 }),
    targetLoadId: varchar("target_load_id", { length: 100 }),
    targetPoNumber: varchar("target_po_number", { length: 100 }),
    bolNumber: varchar("bol_number", { length: 100 }),
    proNumber: varchar("pro_number", { length: 100 }),
    scac: varchar("scac", { length: 10 }),
    origin: jsonb("origin").notNull().default({}),
    destination: jsonb("destination").notNull().default({}),
    intermediateStops: jsonb("intermediate_stops").notNull().default([]),
    commodity: varchar("commodity", { length: 200 }),
    weightLbs: integer("weight_lbs"),
    palletCount: integer("pallet_count"),
    equipmentType: varchar("equipment_type", { length: 50 }),
    specialInstructions: text("special_instructions"),
    rateCents: integer("rate_cents"),
    fuelSurchargeCents: integer("fuel_surcharge_cents"),
    accessorialsCents: integer("accessorials_cents"),
    status: shipmentStatusEnum("status").notNull().default("tendered"),
    statusCode: varchar("status_code", { length: 10 }),
    estimatedPickupAt: timestamp("estimated_pickup_at", { withTimezone: true }),
    estimatedDeliveryAt: timestamp("estimated_delivery_at", {
      withTimezone: true,
    }),
    pickedUpAt: timestamp("picked_up_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    source: shipmentSourceEnum("source").notNull().default("manual"),
    ediRaw: text("edi_raw"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("shipments_status_created_at_idx").on(table.status, table.createdAt),
    index("shipments_partner_slug_idx").on(table.partnerSlug, table.createdAt),
    index("shipments_driver_status_idx").on(table.driverId, table.status),
    index("shipments_org_status_idx").on(table.organizationId, table.status),
    // Composite target for every tenant-scoped child row.
    unique("shipments_id_organization_unique").on(
      table.id,
      table.organizationId,
    ),
    foreignKey({
      columns: [table.carrierId, table.organizationId],
      foreignColumns: [carriers.id, carriers.organizationId],
      name: "shipments_carrier_organization_fk",
    }).onDelete("restrict"),
    /**
     * Defense in depth behind the application check: a driver from another
     * carrier cannot be assigned. `MATCH SIMPLE` means a null `driver_id`
     * satisfies this, which is exactly what the single-column
     * `ON DELETE SET NULL` foreign key above leaves behind.
     */
    foreignKey({
      columns: [table.driverId, table.carrierId],
      foreignColumns: [drivers.id, drivers.carrierId],
      name: "shipments_driver_carrier_fk",
    }).onDelete("no action"),
  ],
);

/**
 * Provider-scoped identifiers are the canonical external identity boundary.
 * Legacy Target columns remain temporarily for dual-read rollback only and
 * must never be used as a cross-provider uniqueness constraint.
 */
export const shipmentExternalReferences = pgTable(
  "shipment_external_references",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    // Foreign key declared compositely with organizationId below.
    shipmentId: uuid("shipment_id").notNull(),
    provider: varchar("provider", { length: 80 }).notNull(),
    referenceType: varchar("reference_type", { length: 80 }).notNull(),
    externalId: varchar("external_id", { length: 160 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("shipment_external_references_provider_unique").on(
      table.organizationId,
      table.provider,
      table.referenceType,
      table.externalId,
    ),
    index("shipment_external_references_shipment_idx").on(
      table.organizationId,
      table.shipmentId,
    ),
    // An external identifier can only ever name a shipment inside its own
    // organization.
    foreignKey({
      columns: [table.shipmentId, table.organizationId],
      foreignColumns: [shipments.id, shipments.organizationId],
      name: "shipment_external_references_shipment_organization_fk",
    }).onDelete("cascade"),
  ],
);

export const shipmentEvents = pgTable(
  "shipment_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shipmentId: uuid("shipment_id")
      .notNull()
      .references(() => shipments.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    eventCode: varchar("event_code", { length: 10 }),
    statusReason: varchar("status_reason", { length: 100 }),
    latitude: varchar("latitude", { length: 30 }),
    longitude: varchar("longitude", { length: 30 }),
    locationAddress: varchar("location_address", { length: 300 }),
    odometerMiles: integer("odometer_miles"),
    notes: text("notes"),
    photoUrls: jsonb("photo_urls").notNull().default([]),
    signatureUrl: text("signature_url"),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    driverId: uuid("driver_id").references(() => drivers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("shipment_events_shipment_recorded_at_idx").on(
      table.shipmentId,
      table.recordedAt,
    ),
    index("shipment_events_driver_recorded_at_idx").on(
      table.driverId,
      table.recordedAt,
    ),
  ],
);

export const ediTransactions = pgTable(
  "edi_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionType: varchar("transaction_type", { length: 10 }).notNull(),
    direction: ediDirectionEnum("direction").notNull().default("inbound"),
    senderId: varchar("sender_id", { length: 100 }),
    receiverId: varchar("receiver_id", { length: 100 }),
    controlNumber: varchar("control_number", { length: 20 }),
    groupControlNumber: varchar("group_control_number", { length: 20 }),
    transactionSetControlNumber: varchar("transaction_set_control_number", {
      length: 20,
    }),
    shipmentId: uuid("shipment_id").references(() => shipments.id, {
      onDelete: "set null",
    }),
    status: ediStatusEnum("status").notNull().default("received"),
    errorMessage: text("error_message"),
    rawContent: text("raw_content"),
    parsedJson: jsonb("parsed_json"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "edi_transactions_type_check",
      sql`${table.transactionType} in ('204', '210', '214', '990', '997')`,
    ),
    uniqueIndex("edi_transactions_control_unique")
      .on(table.direction, table.senderId, table.controlNumber)
      .where(
        sql`${table.senderId} is not null and ${table.controlNumber} is not null`,
      ),
    index("edi_transactions_status_created_at_idx").on(
      table.status,
      table.createdAt,
    ),
    index("edi_transactions_shipment_idx").on(table.shipmentId),
  ],
);

export const driverLocations = pgTable(
  "driver_locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    driverId: uuid("driver_id")
      .notNull()
      .references(() => drivers.id, { onDelete: "cascade" }),
    shipmentId: uuid("shipment_id").references(() => shipments.id, {
      onDelete: "set null",
    }),
    latitude: varchar("latitude", { length: 30 }).notNull(),
    longitude: varchar("longitude", { length: 30 }).notNull(),
    accuracy: integer("accuracy"),
    speed: integer("speed"),
    heading: integer("heading"),
    altitude: integer("altitude"),
    batteryLevel: integer("battery_level"),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("driver_locations_driver_recorded_at_idx").on(
      table.driverId,
      table.recordedAt,
    ),
    index("driver_locations_shipment_recorded_at_idx").on(
      table.shipmentId,
      table.recordedAt,
    ),
  ],
);

export const driverStatusEvents = pgTable(
  "driver_status_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    driverId: uuid("driver_id")
      .notNull()
      .references(() => drivers.id, { onDelete: "cascade" }),
    shipmentId: uuid("shipment_id").references(() => shipments.id, {
      onDelete: "set null",
    }),
    status: hosDutyStatusEnum("status").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("driver_status_events_driver_recorded_at_idx").on(
      table.driverId,
      table.recordedAt,
    ),
    index("driver_status_events_shipment_recorded_at_idx").on(
      table.shipmentId,
      table.recordedAt,
    ),
  ],
);

export const geofences = pgTable(
  "geofences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    type: geofenceTypeEnum("type").notNull().default("store"),
    address: varchar("address", { length: 300 }),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 10 }),
    zip: varchar("zip", { length: 20 }),
    latitude: varchar("latitude", { length: 30 }).notNull(),
    longitude: varchar("longitude", { length: 30 }).notNull(),
    radiusMeters: integer("radius_meters").notNull().default(500),
    targetStoreId: varchar("target_store_id", { length: 50 }),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "geofences_radius_meters_check",
      sql`${table.radiusMeters} between 25 and 50000`,
    ),
    uniqueIndex("geofences_target_store_id_unique")
      .on(table.targetStoreId)
      .where(sql`${table.targetStoreId} is not null`),
  ],
);

/* ───── Fleet, availability, shop, compliance, settlements ───── */

export const vehicleTypeEnum = pgEnum("vehicle_type", ["tractor", "trailer"]);

export const vehicleStatusEnum = pgEnum("vehicle_status", [
  "active",
  "in_shop",
  "out_of_service",
  "retired",
]);

export const availabilityKindEnum = pgEnum("availability_kind", [
  "available",
  "unavailable",
  "time_off",
  "preferred",
]);

export const maintenanceKindEnum = pgEnum("maintenance_kind", [
  "repair",
  "preventive",
  "inspection",
]);

export const maintenanceStatusEnum = pgEnum("maintenance_status", [
  "open",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
]);

export const maintenanceSeverityEnum = pgEnum("maintenance_severity", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const complianceSubjectEnum = pgEnum("compliance_subject", [
  "vehicle",
  "driver",
]);

export const complianceKindEnum = pgEnum("compliance_kind", [
  "registration",
  "ifta",
  "annual_inspection",
  "insurance",
  "cdl",
  "medical_card",
  "hazmat_endorsement",
]);

export const payoutRailEnum = pgEnum("payout_rail", [
  "apple_cash",
  "venmo",
  "cash_app",
  "zelle",
]);

export const payoutStatusEnum = pgEnum("payout_status", [
  "pending",
  "processing",
  "paid",
  "failed",
]);

export const payoutLineItemKindEnum = pgEnum("payout_line_item_kind", [
  "linehaul",
  "accessorial",
  "detention",
  "fuel",
  "advance",
  "deduction",
]);

export const vehicles = pgTable(
  "vehicles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    carrierId: uuid("carrier_id")
      .notNull()
      .references(() => carriers.id, { onDelete: "cascade" }),
    unitNumber: varchar("unit_number", { length: 40 }).notNull(),
    type: vehicleTypeEnum("type").notNull(),
    vin: varchar("vin", { length: 17 }).notNull(),
    make: varchar("make", { length: 60 }).notNull(),
    model: varchar("model", { length: 80 }).notNull(),
    year: integer("year").notNull(),
    plateNumber: varchar("plate_number", { length: 20 }).notNull(),
    plateState: varchar("plate_state", { length: 10 }).notNull(),
    status: vehicleStatusEnum("status").notNull().default("active"),
    odometerMiles: integer("odometer_miles").notNull().default(0),
    thumbnailPath: text("thumbnail_path"),
    assignedDriverId: uuid("assigned_driver_id").references(() => drivers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("vehicles_carrier_status_idx").on(table.carrierId, table.status),
    // The shop, the driver, and dispatch all name a truck by its unit number,
    // so two units inside one carrier may never share one.
    uniqueIndex("vehicles_carrier_unit_unique").on(table.carrierId, table.unitNumber),
    uniqueIndex("vehicles_carrier_vin_unique").on(table.carrierId, table.vin),
    check("vehicles_year_check", sql`${table.year} between 1950 and 2100`),
    check("vehicles_odometer_check", sql`${table.odometerMiles} >= 0`),
    // Composite target for every tenant-scoped child row.
    unique("vehicles_id_carrier_unique").on(table.id, table.carrierId),
    /**
     * Defense in depth behind the application check: a driver from another
     * carrier cannot be assigned a unit. `MATCH SIMPLE` means a null
     * `assigned_driver_id` satisfies this, which is what the single-column
     * `ON DELETE SET NULL` above leaves behind.
     */
    foreignKey({
      columns: [table.assignedDriverId, table.carrierId],
      foreignColumns: [drivers.id, drivers.carrierId],
      name: "vehicles_driver_carrier_fk",
    }).onDelete("no action"),
  ],
);

export const driverAvailabilityBlocks = pgTable(
  "driver_availability_blocks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    carrierId: uuid("carrier_id").notNull(),
    driverId: uuid("driver_id").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    kind: availabilityKindEnum("kind").notNull(),
    note: text("note"),
    ruleId: uuid("rule_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("driver_availability_blocks_driver_starts_at_idx").on(
      table.driverId,
      table.startsAt,
    ),
    index("driver_availability_blocks_carrier_starts_at_idx").on(
      table.carrierId,
      table.startsAt,
    ),
    check("driver_availability_blocks_span_check", sql`${table.endsAt} > ${table.startsAt}`),
    foreignKey({
      columns: [table.driverId, table.carrierId],
      foreignColumns: [drivers.id, drivers.carrierId],
      name: "driver_availability_blocks_driver_carrier_fk",
    }).onDelete("cascade"),
  ],
);

export const driverAvailabilityRules = pgTable(
  "driver_availability_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    carrierId: uuid("carrier_id").notNull(),
    driverId: uuid("driver_id").notNull(),
    /** 0 is Sunday, matching `Date.prototype.getDay`. */
    weekday: integer("weekday").notNull(),
    /**
     * Minutes from local midnight rather than an instant. A stored wall-clock
     * timestamp would drift an hour twice a year; minutes survive DST.
     */
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
    kind: availabilityKindEnum("kind").notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
    effectiveUntil: timestamp("effective_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("driver_availability_rules_driver_weekday_idx").on(
      table.driverId,
      table.weekday,
    ),
    check("driver_availability_rules_weekday_check", sql`${table.weekday} between 0 and 6`),
    check(
      "driver_availability_rules_span_check",
      sql`${table.startMinute} >= 0 and ${table.endMinute} <= 1440 and ${table.endMinute} > ${table.startMinute}`,
    ),
    foreignKey({
      columns: [table.driverId, table.carrierId],
      foreignColumns: [drivers.id, drivers.carrierId],
      name: "driver_availability_rules_driver_carrier_fk",
    }).onDelete("cascade"),
  ],
);

export const driverShiftStatusEnum = pgEnum("driver_shift_status", [
  "scheduled",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
]);

export const shiftCoverageRequestStatusEnum = pgEnum("shift_coverage_request_status", [
  "pending",
  "accepted",
  "declined",
  "closed",
]);

export const scheduleSyncStatusEnum = pgEnum("schedule_sync_status", [
  "pending",
  "synced",
  "failed",
]);

/** An individual dispatch occurrence; coverage never rewrites shipment ownership. */
export const driverShifts = pgTable(
  "driver_shifts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    carrierId: uuid("carrier_id").notNull(),
    driverId: uuid("driver_id").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: driverShiftStatusEnum("status").notNull().default("scheduled"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("driver_shifts_carrier_starts_at_idx").on(table.carrierId, table.startsAt),
    index("driver_shifts_driver_starts_at_idx").on(table.driverId, table.startsAt),
    unique("driver_shifts_id_carrier_unique").on(table.id, table.carrierId),
    check("driver_shifts_span_check", sql`${table.endsAt} > ${table.startsAt}`),
    foreignKey({
      columns: [table.driverId, table.carrierId],
      foreignColumns: [drivers.id, drivers.carrierId],
      name: "driver_shifts_driver_carrier_fk",
    }).onDelete("cascade"),
  ],
);

export const shiftCoverageRequests = pgTable(
  "shift_coverage_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    carrierId: uuid("carrier_id").notNull(),
    shiftId: uuid("shift_id").notNull(),
    fromDriverId: uuid("from_driver_id").notNull(),
    targetDriverId: uuid("target_driver_id").notNull(),
    requestedByUserId: uuid("requested_by_user_id").notNull(),
    status: shiftCoverageRequestStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (table) => [
    index("shift_coverage_requests_carrier_status_idx").on(table.carrierId, table.status),
    index("shift_coverage_requests_target_status_idx").on(table.targetDriverId, table.status),
    foreignKey({
      columns: [table.shiftId, table.carrierId],
      foreignColumns: [driverShifts.id, driverShifts.carrierId],
      name: "shift_coverage_requests_shift_carrier_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.fromDriverId, table.carrierId],
      foreignColumns: [drivers.id, drivers.carrierId],
      name: "shift_coverage_requests_from_driver_carrier_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.targetDriverId, table.carrierId],
      foreignColumns: [drivers.id, drivers.carrierId],
      name: "shift_coverage_requests_target_driver_carrier_fk",
    }).onDelete("cascade"),
  ],
);

export const scheduleSyncStatuses = pgTable(
  "schedule_sync_statuses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    carrierId: uuid("carrier_id").notNull(),
    shiftId: uuid("shift_id").notNull(),
    provider: varchar("provider", { length: 40 }).notNull().default("target"),
    status: scheduleSyncStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    lastError: text("last_error"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("schedule_sync_statuses_shift_unique").on(table.shiftId),
    index("schedule_sync_statuses_carrier_status_idx").on(table.carrierId, table.status),
    foreignKey({
      columns: [table.shiftId, table.carrierId],
      foreignColumns: [driverShifts.id, driverShifts.carrierId],
      name: "schedule_sync_statuses_shift_carrier_fk",
    }).onDelete("cascade"),
  ],
);

export const maintenanceOrders = pgTable(
  "maintenance_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    carrierId: uuid("carrier_id").notNull(),
    vehicleId: uuid("vehicle_id").notNull(),
    kind: maintenanceKindEnum("kind").notNull(),
    status: maintenanceStatusEnum("status").notNull().default("open"),
    severity: maintenanceSeverityEnum("severity").notNull().default("medium"),
    summary: varchar("summary", { length: 200 }).notNull(),
    description: text("description").notNull().default(""),
    openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    odometerMiles: integer("odometer_miles"),
    vendorName: varchar("vendor_name", { length: 200 }),
    costCents: integer("cost_cents"),
    reportedByDriverId: uuid("reported_by_driver_id").references(() => drivers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("maintenance_orders_vehicle_opened_at_idx").on(table.vehicleId, table.openedAt),
    index("maintenance_orders_carrier_status_idx").on(table.carrierId, table.status),
    check("maintenance_orders_cost_check", sql`${table.costCents} is null or ${table.costCents} >= 0`),
    foreignKey({
      columns: [table.vehicleId, table.carrierId],
      foreignColumns: [vehicles.id, vehicles.carrierId],
      name: "maintenance_orders_vehicle_carrier_fk",
    }).onDelete("cascade"),
  ],
);

export const complianceDocuments = pgTable(
  "compliance_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    carrierId: uuid("carrier_id")
      .notNull()
      .references(() => carriers.id, { onDelete: "cascade" }),
    subjectType: complianceSubjectEnum("subject_type").notNull(),
    /**
     * Points at either a vehicle or a driver, so it carries no foreign key of
     * its own. The carrier pin is what keeps it inside its tenant, and the
     * application resolves the subject before writing.
     */
    subjectId: uuid("subject_id").notNull(),
    kind: complianceKindEnum("kind").notNull(),
    identifier: varchar("identifier", { length: 120 }).notNull(),
    issuingState: varchar("issuing_state", { length: 10 }).notNull(),
    issuedOn: timestamp("issued_on", { withTimezone: true }).notNull(),
    expiresOn: timestamp("expires_on", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("compliance_documents_carrier_expires_on_idx").on(
      table.carrierId,
      table.expiresOn,
    ),
    // One document of a given kind per subject; a second registration for the
    // same truck is a replacement, not an addition.
    uniqueIndex("compliance_documents_subject_kind_unique").on(
      table.carrierId,
      table.subjectType,
      table.subjectId,
      table.kind,
    ),
    check("compliance_documents_window_check", sql`${table.expiresOn} > ${table.issuedOn}`),
  ],
);

/**
 * Where a driver wants to be paid.
 *
 * The handle is an account identifier a driver publishes anyway — a Venmo
 * username, a Cash App cashtag, the contact behind Zelle or Apple Cash. It is
 * never a card or bank account number. It is still PII: reads must be scoped to
 * the owning driver, and admin-facing queries select the rail only.
 */
export const driverPayoutMethods = pgTable(
  "driver_payout_methods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    carrierId: uuid("carrier_id").notNull(),
    driverId: uuid("driver_id").notNull(),
    rail: payoutRailEnum("rail").notNull(),
    handle: varchar("handle", { length: 200 }).notNull(),
    label: varchar("label", { length: 80 }),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // One handle per rail per driver, so a settlement can never pick between
    // two Venmo accounts.
    uniqueIndex("driver_payout_methods_driver_rail_unique").on(table.driverId, table.rail),
    // At most one default per driver, enforced by the database rather than by
    // whichever write happened to run last.
    uniqueIndex("driver_payout_methods_driver_default_unique")
      .on(table.driverId)
      .where(sql`${table.isDefault}`),
    foreignKey({
      columns: [table.driverId, table.carrierId],
      foreignColumns: [drivers.id, drivers.carrierId],
      name: "driver_payout_methods_driver_carrier_fk",
    }).onDelete("cascade"),
  ],
);

export const driverPayouts = pgTable(
  "driver_payouts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    carrierId: uuid("carrier_id").notNull(),
    driverId: uuid("driver_id").notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    status: payoutStatusEnum("status").notNull().default("pending"),
    grossCents: integer("gross_cents").notNull(),
    deductionCents: integer("deduction_cents").notNull().default(0),
    netCents: integer("net_cents").notNull(),
    /** The rail a transfer went out on. Never the handle. */
    rail: payoutRailEnum("rail"),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("driver_payouts_driver_period_end_idx").on(table.driverId, table.periodEnd),
    index("driver_payouts_carrier_status_idx").on(table.carrierId, table.status),
    check("driver_payouts_period_check", sql`${table.periodEnd} > ${table.periodStart}`),
    check("driver_payouts_net_check", sql`${table.netCents} = ${table.grossCents} - ${table.deductionCents}`),
    unique("driver_payouts_id_carrier_unique").on(table.id, table.carrierId),
    foreignKey({
      columns: [table.driverId, table.carrierId],
      foreignColumns: [drivers.id, drivers.carrierId],
      name: "driver_payouts_driver_carrier_fk",
    }).onDelete("cascade"),
  ],
);

export const driverPayoutLineItems = pgTable(
  "driver_payout_line_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    carrierId: uuid("carrier_id").notNull(),
    payoutId: uuid("payout_id").notNull(),
    shipmentId: uuid("shipment_id").references(() => shipments.id, {
      onDelete: "set null",
    }),
    kind: payoutLineItemKindEnum("kind").notNull(),
    description: varchar("description", { length: 300 }).notNull(),
    /** Negative for deductions, so the items always sum to the payout's net. */
    amountCents: integer("amount_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("driver_payout_line_items_payout_idx").on(table.payoutId),
    foreignKey({
      columns: [table.payoutId, table.carrierId],
      foreignColumns: [driverPayouts.id, driverPayouts.carrierId],
      name: "driver_payout_line_items_payout_carrier_fk",
    }).onDelete("cascade"),
  ],
);
