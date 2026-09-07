import type {
  AppRole,
  EquipmentType,
  ExceptionCategory,
  ExceptionSeverity,
  ShipmentStatus,
} from "../../domain/types";
import {
  EXCEPTION_CATEGORIES,
  EXCEPTION_SEVERITIES,
  SHIPMENT_STATUSES,
} from "../../domain/types";

export function exceptionCategory(value: string | null): ExceptionCategory {
  return EXCEPTION_CATEGORIES.find((candidate) => candidate === value) ?? "other";
}

export function exceptionSeverity(value: string | null): ExceptionSeverity {
  return EXCEPTION_SEVERITIES.find((candidate) => candidate === value) ?? "medium";
}

export function shipmentStatus(value: string): ShipmentStatus {
  return SHIPMENT_STATUSES.some((status) => status === value) ? value as ShipmentStatus : "exception";
}

export function equipmentType(value: string | null): EquipmentType {
  return value === "reefer" || value === "flatbed" ? value : "dry_van";
}

export function finiteCoordinate(value: string | null): number {
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : 0;
}

export function validDate(value: string): string {
  return Number.isNaN(Date.parse(value)) ? new Date(0).toISOString() : value;
}

export function stringProperty(value: unknown, property: string): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const candidate = (value as Record<string, unknown>)[property];
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
}

export function titleForRole(role: AppRole): string {
  if (role === "admin") return "Operations administrator";
  if (role === "driver") return "Professional driver";
  return "Customer account";
}
