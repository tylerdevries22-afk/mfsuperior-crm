import type { AppRole, ShipmentStatus } from "@/domain/types";

export interface LoadLifecycleAction {
  readonly label: string;
  readonly nextStatus?: ShipmentStatus;
  readonly kind: "status" | "proof_of_delivery";
}

const ACTIONS: Readonly<Partial<Record<ShipmentStatus, LoadLifecycleAction>>> = {
  accepted: { label: "Dispatch load", nextStatus: "dispatched", kind: "status" },
  dispatched: { label: "Arrive at pickup", nextStatus: "at_pickup", kind: "status" },
  at_pickup: { label: "Pickup complete · loaded", nextStatus: "loaded", kind: "status" },
  loaded: { label: "Depart pickup", nextStatus: "in_transit", kind: "status" },
  in_transit: { label: "Arrive at delivery", nextStatus: "at_delivery", kind: "status" },
  at_delivery: { label: "Capture proof of delivery", kind: "proof_of_delivery" },
};

export function loadLifecycleAction(status: ShipmentStatus, role: AppRole): LoadLifecycleAction | null {
  if (role === "customer" || status === "tendered" || status === "exception") return null;
  const action = ACTIONS[status];
  if (!action) return null;
  if (action.nextStatus === "dispatched" && role !== "admin") return null;
  return action;
}
