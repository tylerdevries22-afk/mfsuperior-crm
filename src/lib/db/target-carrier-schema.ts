import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
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
    organizationId: uuid("organization_id").references(
      () => organizations.id,
      { onDelete: "restrict" },
    ),
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
    uniqueIndex("carriers_organization_unique")
      .on(table.organizationId)
      .where(sql`${table.organizationId} is not null`),
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
  ],
);

export const shipments = pgTable(
  "shipments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    carrierId: uuid("carrier_id").references(() => carriers.id, {
      onDelete: "set null",
    }),
    driverId: uuid("driver_id").references(() => drivers.id, {
      onDelete: "set null",
    }),
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
    index("shipments_driver_status_idx").on(table.driverId, table.status),
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
    shipmentId: uuid("shipment_id")
      .notNull()
      .references(() => shipments.id, { onDelete: "cascade" }),
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
