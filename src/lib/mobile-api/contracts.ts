import { z } from "zod";

export const mobilePageQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    status: z.string().trim().min(1).max(40).optional(),
  })
  .strict();

export const mobileShipmentQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    status: z
      .enum([
        "tendered",
        "accepted",
        "dispatched",
        "at_pickup",
        "in_transit",
        "at_delivery",
        "delivered",
        "cancelled",
        "exception",
      ])
      .optional(),
  })
  .strict();

export const mobileRequestQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    status: z
      .enum([
        "draft",
        "submitted",
        "reviewing",
        "quoted",
        "booked",
        "declined",
        "cancelled",
      ])
      .optional(),
  })
  .strict();

export const mobileExceptionQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(200).default(100),
    status: z.enum(["open", "resolved", "all"]).default("all"),
  })
  .strict();

export const mobileSyncQuerySchema = z
  .object({
    deviceId: z.string().trim().min(8).max(120),
    cursor: z.string().trim().min(10).max(200).optional(),
  })
  .strict();

export const freightLocationInputSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    addressLine1: z.string().trim().min(1).max(200),
    addressLine2: z.string().trim().min(1).max(200).optional(),
    city: z.string().trim().min(1).max(100),
    state: z.string().trim().min(2).max(50),
    postalCode: z.string().trim().min(3).max(20),
    countryCode: z.string().trim().length(2).toUpperCase().default("US"),
  })
  .strict();

const nullableDate = z.iso.datetime({ offset: true }).nullable().optional();

export const freightRequestCreateSchema = z
  .object({
    referenceNumber: z.string().trim().min(1).max(120).nullable().optional(),
    subject: z.string().trim().min(4).max(200),
    requestType: z.enum(["quote", "pickup", "delivery", "exception"]).default("quote"),
    shipmentId: z.uuid().nullable().optional(),
    origin: freightLocationInputSchema,
    destination: freightLocationInputSchema,
    pickupWindowStart: nullableDate,
    pickupWindowEnd: nullableDate,
    deliveryWindowStart: nullableDate,
    deliveryWindowEnd: nullableDate,
    commodity: z.string().trim().min(1).max(200).nullable().optional(),
    weightLbs: z.number().int().min(0).max(200_000).nullable().optional(),
    palletCount: z.number().int().min(0).max(1_000).nullable().optional(),
    equipmentType: z.string().trim().min(1).max(50).nullable().optional(),
    notes: z.string().trim().min(1).max(2_000).nullable().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const windows = [
      [value.pickupWindowStart, value.pickupWindowEnd, "pickupWindowEnd"],
      [value.deliveryWindowStart, value.deliveryWindowEnd, "deliveryWindowEnd"],
    ] as const;
    for (const [start, end, path] of windows) {
      if (start && end && new Date(end) < new Date(start)) {
        context.addIssue({
          code: "custom",
          path: [path],
          message: "The window end must not precede its start.",
        });
      }
    }
  });

export const uploadIntentSchema = z
  .object({
    fileName: z.string().trim().min(1).max(255),
    contentType: z.enum([
      "application/pdf",
      "image/heic",
      "image/jpeg",
      "image/png",
      "image/webp",
    ]),
    byteSize: z.number().int().min(1).max(20 * 1024 * 1024),
    kind: z.enum([
      "bill_of_lading",
      "proof_of_delivery",
      "rate_confirmation",
      "receipt",
      "damage_photo",
      "photo",
      "signature",
      "other",
    ]),
    shipmentId: z.uuid().nullable().optional(),
    requestId: z.uuid().nullable().optional(),
  })
  .strict();

const mutationBase = {
  idempotencyKey: z.string().trim().min(16).max(120),
  occurredAt: z.iso.datetime({ offset: true }),
};

const shipmentStatusMutationSchema = z
  .object({
    ...mutationBase,
    operation: z.literal("shipment.status.update"),
    payload: z
      .object({
        shipmentId: z.uuid(),
        status: z.enum([
          "dispatched",
          "at_pickup",
          "in_transit",
          "at_delivery",
          "delivered",
          "exception",
        ]),
        latitude: z.number().min(-90).max(90).nullable().optional(),
        longitude: z.number().min(-180).max(180).nullable().optional(),
        notes: z.string().trim().min(1).max(2_000).nullable().optional(),
      })
      .strict(),
  })
  .strict();

const driverLocationMutationSchema = z
  .object({
    ...mutationBase,
    operation: z.literal("driver.location.record"),
    payload: z
      .object({
        shipmentId: z.uuid().nullable().optional(),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        accuracy: z.number().int().min(0).max(10_000).nullable().optional(),
        speed: z.number().int().min(0).max(400).nullable().optional(),
        heading: z.number().int().min(0).max(359).nullable().optional(),
        batteryLevel: z.number().int().min(0).max(100).nullable().optional(),
      })
      .strict(),
  })
  .strict();

const requestCreateMutationSchema = z
  .object({
    ...mutationBase,
    operation: z.literal("freight_request.create"),
    payload: freightRequestCreateSchema,
  })
  .strict();

const driverDutyStatusMutationSchema = z
  .object({
    ...mutationBase,
    operation: z.literal("driver.duty_status.update"),
    payload: z
      .object({
        status: z.enum([
          "off_duty",
          "sleeper_berth",
          "driving",
          "on_duty_not_driving",
        ]),
        shipmentId: z.uuid().nullable().optional(),
      })
      .strict(),
  })
  .strict();

const shipmentExceptionMutationSchema = z
  .object({
    ...mutationBase,
    operation: z.literal("shipment.exception.report"),
    payload: z
      .object({
        shipmentId: z.uuid(),
        stopId: z.uuid().nullable().optional(),
        category: z.enum([
          "delay",
          "equipment",
          "temperature",
          "cargo_damage",
          "refused_delivery",
          "route",
          "other",
        ]),
        severity: z.enum(["low", "medium", "high", "critical"]),
        description: z.string().trim().min(1).max(2_000),
      })
      .strict(),
  })
  .strict();

const shipmentPhotoMutationSchema = z
  .object({
    ...mutationBase,
    operation: z.literal("shipment.photo.attach"),
    payload: z
      .object({
        shipmentId: z.uuid(),
        documentId: z.uuid(),
      })
      .strict(),
  })
  .strict();

const shipmentSignatureMutationSchema = z
  .object({
    ...mutationBase,
    operation: z.literal("shipment.signature.record"),
    payload: z
      .object({
        shipmentId: z.uuid(),
        documentId: z.uuid(),
      })
      .strict(),
  })
  .strict();

const shipmentPodMutationSchema = z
  .object({
    ...mutationBase,
    operation: z.literal("shipment.pod.submit"),
    payload: z
      .object({
        shipmentId: z.uuid(),
        stopId: z.uuid().nullable().optional(),
        recipientName: z.string().trim().min(1).max(200),
        notes: z.string().trim().min(1).max(2_000).nullable().optional(),
        signatureDocumentId: z.uuid().nullable().optional(),
        photoDocumentIds: z.array(z.uuid()).max(8).optional(),
      })
      .strict(),
  })
  .strict();

const availabilityBlockMutationSchema = z
  .object({
    ...mutationBase,
    operation: z.literal("availability.block.set"),
    payload: z
      .object({
        id: z.uuid().nullable().optional(),
        driverId: z.uuid().nullable().optional(),
        startsAt: z.iso.datetime({ offset: true }),
        endsAt: z.iso.datetime({ offset: true }),
        kind: z.enum(["available", "unavailable", "time_off", "preferred"]),
        note: z.string().trim().max(500).nullable().optional(),
      })
      .strict(),
  })
  .strict();

const availabilityBlockRemovalMutationSchema = z
  .object({
    ...mutationBase,
    operation: z.literal("availability.block.remove"),
    payload: z.object({ id: z.uuid() }).strict(),
  })
  .strict();

export const offlineMutationBatchSchema = z
  .object({
    mutations: z
      .array(
        z.discriminatedUnion("operation", [
          shipmentStatusMutationSchema,
          driverLocationMutationSchema,
          driverDutyStatusMutationSchema,
          shipmentExceptionMutationSchema,
          shipmentPhotoMutationSchema,
          shipmentSignatureMutationSchema,
          shipmentPodMutationSchema,
          requestCreateMutationSchema,
          availabilityBlockMutationSchema,
          availabilityBlockRemovalMutationSchema,
        ]),
      )
      .min(1)
      .max(25),
  })
  .strict();

export const shipmentTenderResponseSchema = z
  .object({
    response: z.enum(["accepted", "declined"]),
    notes: z.string().trim().min(1).max(2_000).nullable().optional(),
  })
  .strict();

/**
 * Assignment is driver-only. The equipment register the mobile client once
 * carried (tractors, trailers, reefer units) has been removed from the
 * product, so there is nothing on either side to assign.
 */
export const shipmentAssignmentSchema = z
  .object({
    driverId: z.uuid(),
    notes: z.string().trim().min(1).max(2_000).nullable().optional(),
  })
  .strict();

/** Only the statuses a shipment may legally resume into after an exception. */
export const shipmentExceptionResolutionSchema = z
  .object({
    resolutionNote: z.string().trim().min(5).max(2_000),
    resumeStatus: z.enum(["dispatched", "in_transit", "at_delivery", "cancelled"]),
  })
  .strict();

export const mobileMessageQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(200).default(100),
    threadKey: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export const operationsMessageCreateSchema = z
  .object({
    threadKey: z.string().trim().min(1).max(120),
    threadKind: z.enum(["shipment", "dispatch", "support"]),
    shipmentId: z.uuid().nullable().optional(),
    recipientUserIds: z.array(z.uuid()).min(1).max(25),
    body: z.string().trim().min(1).max(4_000),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.threadKind === "shipment" && !value.shipmentId) {
      context.addIssue({
        code: "custom",
        path: ["shipmentId"],
        message: "A shipment thread requires a shipment.",
      });
    }
  });

export const idempotencyKeySchema = z.string().trim().min(16).max(120);

export type ShipmentTenderResponse = z.output<typeof shipmentTenderResponseSchema>;
export type ShipmentAssignment = z.output<typeof shipmentAssignmentSchema>;
export type ShipmentExceptionResolution = z.output<
  typeof shipmentExceptionResolutionSchema
>;

export type FreightRequestCreate = z.output<typeof freightRequestCreateSchema>;
export type OfflineMutation = z.output<
  typeof offlineMutationBatchSchema
>["mutations"][number];

/* ───── Fleet, availability, shop, compliance, settlements ───── */

const isoDateTime = z.iso.datetime({ offset: true });

export const availabilityQuerySchema = z
  .object({
    driverId: z.uuid().optional(),
    from: isoDateTime.optional(),
    to: isoDateTime.optional(),
    limit: z.coerce.number().int().min(1).max(500).default(200),
  })
  .strict();

export const availabilityBlockWriteSchema = z
  .object({
    id: z.uuid().nullable().optional(),
    /** Admins may name a driver; a driver's own id is taken from the token. */
    driverId: z.uuid().nullable().optional(),
    startsAt: isoDateTime,
    endsAt: isoDateTime,
    kind: z.enum(["available", "unavailable", "time_off", "preferred"]),
    note: z.string().trim().max(500).nullable().optional(),
  })
  .strict()
  .refine(
    (value) => Date.parse(value.endsAt) > Date.parse(value.startsAt),
    { message: "An availability block has to end after it starts.", path: ["endsAt"] },
  );

export const availabilityRuleWriteSchema = z
  .object({
    id: z.uuid().nullable().optional(),
    driverId: z.uuid().nullable().optional(),
    weekday: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1_440),
    endMinute: z.number().int().min(0).max(1_440),
    kind: z.enum(["available", "unavailable", "time_off", "preferred"]),
    effectiveFrom: isoDateTime,
    effectiveUntil: isoDateTime.nullable().optional(),
  })
  .strict()
  .refine((value) => value.endMinute > value.startMinute, {
    message: "A weekly pattern has to cover a real span inside one day.",
    path: ["endMinute"],
  });

export const driverShiftWriteSchema = z
  .object({
    id: z.uuid().nullable().optional(),
    driverId: z.uuid(),
    startsAt: isoDateTime,
    endsAt: isoDateTime,
    status: z.enum(["scheduled", "confirmed", "in_progress", "completed", "cancelled"]).optional(),
    note: z.string().trim().max(500).nullable().optional(),
  })
  .strict()
  .refine((value) => Date.parse(value.endsAt) > Date.parse(value.startsAt), {
    message: "A shift has to end after it starts.",
    path: ["endsAt"],
  });

export const shiftCoverageRequestSchema = z
  .object({ targetDriverId: z.uuid() })
  .strict();

export const shiftCoverageResponseSchema = z
  .object({ response: z.enum(["accepted", "declined"]) })
  .strict();

/**
 * A payout handle, never a card or bank account number. The length ceiling and
 * the digit guard exist so a mistyped account number is refused at the boundary
 * rather than written to a column.
 */
export const payoutMethodWriteSchema = z
  .object({
    id: z.uuid().nullable().optional(),
    rail: z.enum(["apple_cash", "venmo", "cash_app", "zelle"]),
    handle: z
      .string()
      .trim()
      .min(3)
      .max(200)
      .refine(
        (handle) => !(handle.replace(/\D/g, "").length >= 12 && !handle.includes("@")),
        { message: "That looks like a card or account number. Enter the handle for the app instead." },
      ),
    label: z.string().trim().max(80).nullable().optional(),
    isDefault: z.boolean().nullable().optional(),
  })
  .strict();

export const vehicleQuerySchema = z
  .object({
    status: z.enum(["active", "in_shop", "out_of_service", "retired"]).optional(),
    type: z.enum(["tractor", "trailer"]).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
  })
  .strict();

export const vehicleWriteSchema = z
  .object({
    id: z.uuid().nullable().optional(),
    unitNumber: z.string().trim().min(1).max(40),
    type: z.enum(["tractor", "trailer"]),
    vin: z.string().trim().length(17).toUpperCase(),
    make: z.string().trim().min(1).max(60),
    model: z.string().trim().min(1).max(80),
    year: z.number().int().min(1950).max(2100),
    plateNumber: z.string().trim().min(1).max(20),
    plateState: z.string().trim().min(2).max(10),
    status: z.enum(["active", "in_shop", "out_of_service", "retired"]),
    odometerMiles: z.number().int().min(0).max(5_000_000),
    assignedDriverId: z.uuid().nullable().optional(),
  })
  .strict();

export const vehicleAssignmentSchema = z
  .object({ driverId: z.uuid().nullable() })
  .strict();

export const maintenanceQuerySchema = z
  .object({
    vehicleId: z.uuid().optional(),
    status: z.enum(["open", "scheduled", "in_progress", "completed", "cancelled"]).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
  })
  .strict();

export const maintenanceCreateSchema = z
  .object({
    vehicleId: z.uuid(),
    kind: z.enum(["repair", "preventive", "inspection"]),
    severity: z.enum(["low", "medium", "high", "critical"]),
    summary: z.string().trim().min(3).max(200),
    description: z.string().trim().max(4_000).default(""),
    scheduledFor: isoDateTime.nullable().optional(),
    odometerMiles: z.number().int().min(0).max(5_000_000).nullable().optional(),
    vendorName: z.string().trim().max(200).nullable().optional(),
    costCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
    reportedByDriverId: z.uuid().nullable().optional(),
  })
  .strict();

export const maintenanceUpdateSchema = z
  .object({
    status: z.enum(["open", "scheduled", "in_progress", "completed", "cancelled"]).nullable().optional(),
    severity: z.enum(["low", "medium", "high", "critical"]).nullable().optional(),
    scheduledFor: isoDateTime.nullable().optional(),
    completedAt: isoDateTime.nullable().optional(),
    vendorName: z.string().trim().max(200).nullable().optional(),
    costCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
    description: z.string().trim().max(4_000).nullable().optional(),
  })
  .strict();

export const complianceQuerySchema = z
  .object({
    subjectType: z.enum(["vehicle", "driver"]).optional(),
    subjectId: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(500).default(200),
  })
  .strict();

export const complianceWriteSchema = z
  .object({
    id: z.uuid().nullable().optional(),
    subjectType: z.enum(["vehicle", "driver"]),
    subjectId: z.uuid(),
    kind: z.enum([
      "registration",
      "ifta",
      "annual_inspection",
      "insurance",
      "cdl",
      "medical_card",
      "hazmat_endorsement",
    ]),
    identifier: z.string().trim().min(1).max(120),
    issuingState: z.string().trim().min(2).max(10),
    issuedOn: isoDateTime,
    expiresOn: isoDateTime,
  })
  .strict()
  .refine(
    (value) => Date.parse(value.expiresOn) > Date.parse(value.issuedOn),
    { message: "A document has to expire after it was issued.", path: ["expiresOn"] },
  );

export const payoutQuerySchema = z
  .object({
    driverId: z.uuid().optional(),
    status: z.enum(["pending", "processing", "paid", "failed"]).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
  })
  .strict();

export const payoutIssueSchema = z
  .object({
    driverId: z.uuid(),
    periodStart: isoDateTime,
    periodEnd: isoDateTime,
  })
  .strict()
  .refine(
    (value) => Date.parse(value.periodEnd) > Date.parse(value.periodStart),
    { message: "A settlement period has to end after it starts.", path: ["periodEnd"] },
  );

/**
 * Recording a settlement as paid names the rail only. The handle is never sent
 * to, or accepted from, an admin client.
 */
export const payoutPaymentSchema = z
  .object({ rail: z.enum(["apple_cash", "venmo", "cash_app", "zelle"]) })
  .strict();
