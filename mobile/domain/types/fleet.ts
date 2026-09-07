import type { EntityId, IsoDateTime } from "./core";

export const VEHICLE_TYPES = ["truck", "trailer"] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const VEHICLE_STATUSES = [
  "active",
  "in_shop",
  "out_of_service",
  "retired",
] as const;

export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export interface Vehicle {
  readonly id: EntityId;
  readonly unitNumber: string;
  readonly type: VehicleType;
  readonly vin: string;
  readonly make: string;
  readonly model: string;
  readonly year: number;
  readonly plateNumber: string;
  readonly plateState: string;
  readonly status: VehicleStatus;
  readonly odometerMiles: number;
  readonly assignedDriverId?: EntityId;
  /** Signed or public Supabase Storage URL returned by the API. */
  readonly thumbnailUrl?: string | null;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface VehicleInput {
  readonly id?: EntityId;
  readonly unitNumber: string;
  readonly type: VehicleType;
  readonly vin: string;
  readonly make: string;
  readonly model: string;
  readonly year: number;
  readonly plateNumber: string;
  readonly plateState: string;
  readonly status: VehicleStatus;
  readonly odometerMiles: number;
  readonly assignedDriverId?: EntityId;
  readonly thumbnailUrl?: string | null;
}

export interface VehicleThumbnailSource {
  readonly uri: string;
  readonly fileName: string;
  readonly contentType: string;
}
