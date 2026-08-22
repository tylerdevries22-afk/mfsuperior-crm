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
