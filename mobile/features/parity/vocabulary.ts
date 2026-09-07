/**
 * Frozen role sets, deterministic UI states, and the reusable component
 * bundles every parity draft is assembled from.
 */

import type { ReferenceRoute } from "./reference-routes";
import type { ComponentFamily, ParityDraft, ParityRole, ParityState } from "./types";

export const PARITY_STATES = Object.freeze([
  "default",
  "loading",
  "empty",
  "error",
  "offline",
  "reduced-motion",
] as const satisfies readonly ParityState[]);

export const PUBLIC = Object.freeze(["public"] as const satisfies readonly ParityRole[]);
export const STAFF = Object.freeze(["admin", "driver"] as const satisfies readonly ParityRole[]);
export const ADMIN = Object.freeze(["admin"] as const satisfies readonly ParityRole[]);
export const CUSTOMER = Object.freeze(["customer"] as const satisfies readonly ParityRole[]);
export const AUTHENTICATED = Object.freeze(["admin", "driver", "customer"] as const satisfies readonly ParityRole[]);

export const AUTH_COMPONENTS = ["Screen", "Header", "TextField", "AnimatedButton", "StateViews"] as const;
export const RECORD_COMPONENTS = ["Screen", "Header", "WorkspaceCard", "StatusBadge", "StateViews"] as const;
export const MARKET_COMPONENTS = [
  "Screen",
  "Header",
  "HorizontalCarousel",
  "WorkspaceCard",
  "AnimatedButton",
  "Sheet",
  "StateViews",
] as const;
export const DETAIL_COMPONENTS = [
  "Screen",
  "Header",
  "WorkspaceCard",
  "Timeline",
  "StatusBadge",
  "Sheet",
  "StateViews",
] as const;
export const SEARCH_COMPONENTS = [
  "Screen",
  "Header",
  "TextField",
  "SegmentedControl",
  "AnimatedCard",
  "StateViews",
] as const;
export const ADMIN_COMPONENTS = [
  "Screen",
  "Header",
  "SegmentedControl",
  "WorkspaceCard",
  "List",
  "StatusBadge",
  "Drawer",
  "StateViews",
] as const;

export function route(
  referenceRoute: ReferenceRoute,
  mfRoute: `/${string}`,
  roles: readonly ParityRole[],
  components: readonly ComponentFamily[],
): ParityDraft {
  return { referenceRoute, mfRoute, roles, states: PARITY_STATES, components };
}
