import { z } from "zod";

export const shipmentStatuses = [
  "tendered",
  "accepted",
  "dispatched",
  "at_pickup",
  "in_transit",
  "at_delivery",
  "delivered",
  "cancelled",
  "exception",
] as const;

export const shipmentIdSchema = z.uuid();

const driverStatuses = [
  "available",
  "on_duty",
  "off_duty",
  "suspended",
] as const;

const optionalText = (maximum: number) =>
  z.string().trim().min(1).max(maximum).nullable().optional();

const optionalUuid = z.uuid().nullable().optional();
const optionalDate = z.iso.datetime({ offset: true }).transform((value) =>
  new Date(value),
).nullable().optional();

const paginationFields = {
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  q: z.string().trim().min(1).max(100).optional(),
};

const shipmentLocationSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    address: z.string().trim().min(1).max(300).optional(),
    city: z.string().trim().min(1).max(100),
    state: z.string().trim().min(2).max(50),
    postalCode: z.string().trim().min(3).max(20).optional(),
  })
  .strict();

export const driverListQuerySchema = z
  .object({
    ...paginationFields,
    status: z.enum(driverStatuses).optional(),
  })
  .strict();

export const driverCreateSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: z.email().max(320).nullable().optional(),
    phone: optionalText(50),
    licenseNumber: optionalText(100),
    licenseState: optionalText(10),
    cdlType: optionalText(20),
    status: z.enum(driverStatuses).optional(),
  })
  .strict();

export const shipmentListQuerySchema = z
  .object({
    ...paginationFields,
    status: z.enum(shipmentStatuses).optional(),
  })
  .strict();

export const shipmentCreateSchema = z
  .object({
    driverId: optionalUuid,
    targetLoadId: optionalText(100),
    targetPoNumber: optionalText(100),
    bolNumber: optionalText(100),
    proNumber: optionalText(100),
    scac: optionalText(10),
    origin: shipmentLocationSchema,
    destination: shipmentLocationSchema,
    intermediateStops: z.array(shipmentLocationSchema).max(20).default([]),
    commodity: optionalText(200),
    weightLbs: z.number().int().nonnegative().max(200_000).nullable().optional(),
    palletCount: z.number().int().nonnegative().max(1_000).nullable().optional(),
    equipmentType: optionalText(50),
    specialInstructions: optionalText(2_000),
    rateCents: z.number().int().nonnegative().max(100_000_000).nullable().optional(),
    fuelSurchargeCents: z.number().int().nonnegative().max(100_000_000).nullable().optional(),
    accessorialsCents: z.number().int().nonnegative().max(100_000_000).nullable().optional(),
    status: z.literal("tendered").optional(),
    statusCode: optionalText(10),
    estimatedPickupAt: optionalDate,
    estimatedDeliveryAt: optionalDate,
    source: z.enum(["manual", "simulated"]).optional(),
  })
  .strict();

export const shipmentUpdateSchema = z
  .object({
    driverId: optionalUuid,
    status: z.enum(shipmentStatuses).optional(),
    statusCode: optionalText(10),
    statusReason: optionalText(100),
    notes: optionalText(2_000),
    estimatedPickupAt: optionalDate,
    estimatedDeliveryAt: optionalDate,
  })
  .strict()
  .refine(
    (value) => value.status || (!value.statusReason && !value.notes),
    {
      message: "Status reason and notes require a status update.",
      path: ["status"],
    },
  )
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one update field is required.",
  });

export const ediListQuerySchema = z
  .object({
    ...paginationFields,
    direction: z.enum(["inbound", "outbound"]).optional(),
    status: z
      .enum(["received", "parsed", "processed", "error", "acknowledged"])
      .optional(),
    transactionType: z.enum(["204", "210", "214", "990", "997"]).optional(),
  })
  .strict();

export type DriverListQuery = z.output<typeof driverListQuerySchema>;
export type EdiListQuery = z.output<typeof ediListQuerySchema>;
export type ShipmentListQuery = z.output<typeof shipmentListQuerySchema>;
export type ShipmentUpdate = z.output<typeof shipmentUpdateSchema>;

const allowedTransitions: Record<
  (typeof shipmentStatuses)[number],
  ReadonlySet<(typeof shipmentStatuses)[number]>
> = {
  tendered: new Set(["accepted", "cancelled"]),
  accepted: new Set(["dispatched", "cancelled", "exception"]),
  dispatched: new Set(["at_pickup", "cancelled", "exception"]),
  at_pickup: new Set(["in_transit", "cancelled", "exception"]),
  in_transit: new Set(["at_delivery", "exception"]),
  at_delivery: new Set(["delivered", "exception"]),
  delivered: new Set(),
  cancelled: new Set(),
  exception: new Set(["dispatched", "in_transit", "at_delivery", "cancelled"]),
};

export function canTransitionShipmentStatus(
  current: (typeof shipmentStatuses)[number],
  next: (typeof shipmentStatuses)[number],
) {
  return current === next || allowedTransitions[current].has(next);
}
