import type { Vehicle, VehicleType } from "./types";

/** Compatibility only: the existing backend and saved demos used this retired name. */
type LegacyVehicle = Omit<Vehicle, "type"> & { readonly type: "tractor" };

export function normalizeVehicle(vehicle: Vehicle | LegacyVehicle): Vehicle {
  return vehicle.type === "tractor" ? { ...vehicle, type: "truck" } : vehicle;
}

/** Keep the current API contract until its database enum is migrated. */
export function vehicleTypeForApi(type: VehicleType): "tractor" | "trailer" {
  return type === "truck" ? "tractor" : "trailer";
}
