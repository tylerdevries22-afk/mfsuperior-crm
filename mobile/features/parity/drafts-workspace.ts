/**
 * Shared workspace routes: history, knowledge, messaging, profile, and the
 * remaining provider-neutral field and authoring surfaces.
 */

import type { ParityDraft } from "./types";
import {
  ADMIN,
  AUTHENTICATED,
  DETAIL_COMPONENTS,
  MARKET_COMPONENTS,
  SEARCH_COMPONENTS,
  STAFF,
  route,
} from "./vocabulary";

export const WORKSPACE_DRAFTS = [
  route("/history", "/history", AUTHENTICATED, [
    "Screen",
    "Header",
    "SegmentedControl",
    "Timeline",
    "StatusBadge",
    "StateViews",
  ]),
  route("/knowledge", "/knowledge", AUTHENTICATED, SEARCH_COMPONENTS),

  route("/messages", "/messages", AUTHENTICATED, [
    "Screen",
    "Header",
    "List",
    "TextField",
    "StatusBadge",
    "StateViews",
  ]),
  route("/new-diagnosis", "/exception/new", STAFF, [
    "Screen",
    "Header",
    "TextField",
    "AnimatedButton",
    "Sheet",
    "StateViews",
  ]),

  route("/profile-details", "/profile-details", AUTHENTICATED, [
    "Screen",
    "Header",
    "List",
    "TextField",
    "AnimatedButton",
    "StateViews",
  ]),
  route("/session/[id]", "/exception-session/[id]", STAFF, DETAIL_COMPONENTS),
  route("/symptoms", "/exception-signals", STAFF, [
    "Screen",
    "Header",
    "SegmentedControl",
    "AnimatedCard",
    "AnimatedButton",
    "StateViews",
  ]),
  route("/tech-sheet-viewer", "/freight-document-viewer", STAFF, [
    "Screen",
    "Header",
    "GlassCard",
    "HorizontalCarousel",
    "StateViews",
  ]),
  route("/tools-supplies", "/driver-toolbox", STAFF, [
    "Screen",
    "Header",
    "HorizontalCarousel",
    "WorkspaceCard",
    "StateViews",
  ]),
  route("/tree-editor", "/workflow-builder", ADMIN, [
    "Screen",
    "Header",
    "AnimatedCard",
    "Drawer",
    "Sheet",
    "StateViews",
  ]),
  route("/union-parts", "/suppliers", STAFF, MARKET_COMPONENTS),
] as const satisfies readonly ParityDraft[];
