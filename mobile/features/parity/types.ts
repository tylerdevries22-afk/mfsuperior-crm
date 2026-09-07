/**
 * Shared vocabulary types for the reference parity contract.
 */

import type { REFERENCE_COMMIT, ReferenceRoute } from "./reference-routes";

export type ParityRole = "public" | "admin" | "driver" | "customer";
export type ParityState = "default" | "loading" | "empty" | "error" | "offline" | "reduced-motion";
export type ComponentFamily =
  | "AnimatedButton"
  | "AnimatedCard"
  | "AnimatedPressable"
  | "Drawer"
  | "GlassCard"
  | "Header"
  | "HorizontalCarousel"
  | "List"
  | "NativeTabs"
  | "Screen"
  | "SegmentedControl"
  | "Sheet"
  | "StateViews"
  | "StatusBadge"
  | "TextField"
  | "Timeline"
  | "WorkspaceCard";

export type ParityMapping = {
  readonly referenceCommit: typeof REFERENCE_COMMIT;
  readonly referenceRoute: ReferenceRoute;
  readonly mfRoute: `/${string}`;
  readonly roles: readonly ParityRole[];
  readonly states: readonly ParityState[];
  readonly components: readonly ComponentFamily[];
  readonly componentHash: `fnv1a32:${string}`;
};

export type ParityDraft = Omit<ParityMapping, "referenceCommit" | "componentHash">;
export type ParityHashInput = Omit<ParityMapping, "componentHash">;
