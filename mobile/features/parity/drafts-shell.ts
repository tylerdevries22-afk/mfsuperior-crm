/**
 * Auth, tab shell, admin configuration, and exception-diagnosis routes.
 */

import type { ParityDraft } from "./types";
import {
  ADMIN,
  AUTHENTICATED,
  AUTH_COMPONENTS,
  CUSTOMER,
  DETAIL_COMPONENTS,
  PUBLIC,
  RECORD_COMPONENTS,
  STAFF,
  route,
} from "./vocabulary";

export const SHELL_DRAFTS = [
  route("/(auth)/callback", "/(auth)/callback", PUBLIC, AUTH_COMPONENTS),
  route("/(auth)/login", "/(auth)/login", PUBLIC, AUTH_COMPONENTS),
  route("/(auth)/reset-password", "/(auth)/reset-password", PUBLIC, AUTH_COMPONENTS),
  route("/(tabs)", "/(tabs)", AUTHENTICATED, ["NativeTabs"]),
  route("/(tabs)/appliances", "/(tabs)/shipments", CUSTOMER, [
    ...RECORD_COMPONENTS,
    "SegmentedControl",
    "Timeline",
  ]),
  route("/(tabs)/diagnose", "/(tabs)/assistant", STAFF, [
    "Screen",
    "Header",
    "GlassCard",
    "AnimatedButton",
    "HorizontalCarousel",
    "Sheet",
    "StateViews",
  ]),
  route("/(tabs)/inventory", "/(tabs)/hq", STAFF, [
    ...RECORD_COMPONENTS,
    "SegmentedControl",
    "Drawer",
  ]),
  route("/(tabs)/schedule", "/(tabs)/schedule", STAFF, [
    "Screen",
    "Header",
    "SegmentedControl",
    "Timeline",
    "Drawer",
    "StateViews",
  ]),
  route("/(tabs)/service-requests", "/(tabs)/requests", CUSTOMER, [
    ...RECORD_COMPONENTS,
    "Sheet",
  ]),
  route("/(tabs)/settings", "/(tabs)/profile", AUTHENTICATED, [
    "Screen",
    "Header",
    "List",
    "StatusBadge",
    "Sheet",
    "StateViews",
  ]),
  route("/analytics", "/analytics", ADMIN, [
    "Screen",
    "Header",
    "SegmentedControl",
    "WorkspaceCard",
    "StateViews",
  ]),
  route("/configure", "/configure", ADMIN, [
    "Screen",
    "Header",
    "List",
    "AnimatedButton",
    "StateViews",
  ]),
  route("/diagnosis", "/exception-diagnosis", STAFF, DETAIL_COMPONENTS),
  route("/diagnostic", "/exception-diagnostic", STAFF, [
    "Screen",
    "Header",
    "GlassCard",
    "AnimatedButton",
    "Timeline",
    "Sheet",
    "StateViews",
  ]),

  route("/error-codes", "/exception-codes", STAFF, [
    "Screen",
    "Header",
    "TextField",
    "SegmentedControl",
    "List",
    "StateViews",
  ]),
  route("/error-codes/[id]", "/exception-codes/[id]", STAFF, DETAIL_COMPONENTS),
] as const satisfies readonly ParityDraft[];
