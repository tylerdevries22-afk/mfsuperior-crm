import type { Driver, GeoPoint, Shipment } from "@/domain/types";
import { THEME } from "@/theme";

export const CLOSED = new Set(["delivered", "declined", "cancelled"]);
/**
 * Share of the map covered by the sheet at its half snap. The map sits below
 * the header while the sheet is measured against the whole screen, so this runs
 * a little past the raw 0.5 ratio; it only pads the camera, never the layout.
 */
export const SHEET_INSET_RATIO = 0.56;
export const TICK_MS = 1000;

/** Cosmetic fleet livery. Duty state rides on the status dot, never the body. */
export const BODY_COLORS = { yellow: "#E8DE2A", white: "#F4F5F0" } as const;

export const STATUS_COLORS: Record<string, string> = {
  on_duty: THEME.primary,
  available: THEME.success,
  off_duty: THEME.textMuted,
  suspended: THEME.danger,
};

export type FleetRow = {
  readonly driver: Driver;
  readonly load?: Shipment;
  readonly position: GeoPoint;
};
