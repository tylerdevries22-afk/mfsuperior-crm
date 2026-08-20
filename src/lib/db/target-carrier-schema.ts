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

export const carriers = pgTable("carriers", {
  id: uuid("id").defaultRandom().primaryKey(),
  scac: varchar("scac", { length: 10 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  dotNumber: varchar("dot_number", { length: 20 }),
  contactEmail: text("contact_email"),
  contactPhone: varchar("contact_phone", { length: 50 }),
  targetVendorId: varchar("target_vendor_id", { length: 100 }),
  ediQualifier: varchar("edi_qualifier", { length: 50 }),
  ediId: varchar("edi_id", { length: 50 }),
  status: carrierStatusEnum("status").notNull().default("active"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const drivers = pgTable("drivers", {
  id: uuid("id").defaultRandom().primaryKey(),
  carrierId: uuid("carrier_id").references(() => carriers.id, { onDelete: "cascade" }).notNull(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  email: text("email"),
  phone: varchar("phone", { length: 50 }),
  licenseNumber: varchar("license_number", { length: 100 }),
  licenseState: varchar("license_state", { length: 10 }),
  cdhType: varchar("cdh_type", { length: 20 }),
  status: driverStatusEnum("status").notNull().default("available"),
  currentLat: varchar("current_lat", { length: 30 }),
  currentLng: varchar("current_lng", { length: 30 }),
  locationUpdatedAt: timestamp("location_updated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const shipments = pgTable("shipments", {
  id: uuid("id").defaultRandom().primaryKey(),
  carrierId: uuid("carrier_id").references(() => carriers.id, { onDelete: "set null" }),
  driverId: uuid("driver_id").references(() => drivers.id, { onDelete: "set null" }),
  targetLoadId: varchar("target_load_id", { length: 100 }),
  targetPoNumber: varchar("target_po_number", { length: 100 }),
  bolNumber: varchar("bol_number", { length: 100 }),
  proNumber: varchar("pro_number", { length: 100 }),
  scac: varchar("scac", { length: 10 }),
  origin: jsonb("origin").default({}),
  destination: jsonb("destination").default({}),
  intermediateStops: jsonb("intermediate_stops").default([]),
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
  estimatedDeliveryAt: timestamp("estimated_delivery_at", { withTimezone: true }),
  pickedUpAt: timestamp("picked_up_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  source: varchar("source", { length: 50 }).notNull().default("manual"),
  ediRaw: text("edi_raw"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const shipmentEvents = pgTable("shipment_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  shipmentId: uuid("shipment_id").references(() => shipments.id, { onDelete: "cascade" }).notNull(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  eventCode: varchar("event_code", { length: 10 }),
  statusReason: varchar("status_reason", { length: 100 }),
  latitude: varchar("latitude", { length: 30 }),
  longitude: varchar("longitude", { length: 30 }),
  locationAddress: varchar("location_address", { length: 300 }),
  odometerMiles: integer("odometer_miles"),
  notes: text("notes"),
  photoUrls: jsonb("photo_urls").default([]),
  signatureUrl: text("signature_url"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  driverId: uuid("driver_id").references(() => drivers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const ediTransactions = pgTable("edi_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  transactionType: varchar("transaction_type", { length: 10 }).notNull(),
  direction: varchar("direction", { length: 10 }).notNull().default("inbound"),
  senderId: varchar("sender_id", { length: 100 }),
  receiverId: varchar("receiver_id", { length: 100 }),
  controlNumber: varchar("control_number", { length: 20 }),
  groupControlNumber: varchar("group_control_number", { length: 20 }),
  transactionSetControlNumber: varchar("transaction_set_control_number", { length: 20 }),
  shipmentId: uuid("shipment_id").references(() => shipments.id, { onDelete: "set null" }),
  status: varchar("status", { length: 20 }).notNull().default("received"),
  errorMessage: text("error_message"),
  rawContent: text("raw_content"),
  parsedJson: jsonb("parsed_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const driverLocations = pgTable("driver_locations", {
  id: uuid("id").defaultRandom().primaryKey(),
  driverId: uuid("driver_id").references(() => drivers.id, { onDelete: "cascade" }).notNull(),
  shipmentId: uuid("shipment_id").references(() => shipments.id, { onDelete: "set null" }),
  latitude: varchar("latitude", { length: 30 }).notNull(),
  longitude: varchar("longitude", { length: 30 }).notNull(),
  accuracy: integer("accuracy"),
  speed: integer("speed"),
  heading: integer("heading"),
  altitude: integer("altitude"),
  batteryLevel: integer("battery_level"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const geofences = pgTable("geofences", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  type: varchar("type", { length: 50 }).notNull().default("store"),
  address: varchar("address", { length: 300 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 10 }),
  zip: varchar("zip", { length: 20 }),
  latitude: varchar("latitude", { length: 30 }).notNull(),
  longitude: varchar("longitude", { length: 30 }).notNull(),
  radiusMeters: integer("radius_meters").notNull().default(500),
  targetStoreId: varchar("target_store_id", { length: 50 }),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
