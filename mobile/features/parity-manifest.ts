/**
 * Machine-readable route and component parity contract for Appliance
 * Diagnostic Systems commit 480991b7eb0036e4e85c37d3784b2de2ca97d10d.
 *
 * Provider-neutral marketplace routes are intentional. Named freight
 * partners belong only in Profile > Integrations and never own product IA.
 */

export const REFERENCE_COMMIT = "480991b7eb0036e4e85c37d3784b2de2ca97d10d" as const;

export const REFERENCE_ROUTES = [
  "/(auth)/callback",
  "/(auth)/login",
  "/(auth)/reset-password",
  "/(tabs)",
  "/(tabs)/appliances",
  "/(tabs)/diagnose",
  "/(tabs)/inventory",
  "/(tabs)/schedule",
  "/(tabs)/service-requests",
  "/(tabs)/settings",
  "/analytics",
  "/configure",
  "/diagnosis",
  "/diagnostic",
  "/encompass-parts",
  "/encompass-parts/cart",
  "/encompass-parts/orders",
  "/encompass-parts/part-detail",
  "/encompass-parts/return-request",
  "/encompass-parts/search",
  "/error-codes",
  "/error-codes/[id]",
  "/hcp",
  "/hcp/customer/[id]",
  "/hcp/customers",
  "/hcp/employees",
  "/hcp/estimates",
  "/hcp/invoices",
  "/hcp/job/[id]",
  "/hcp/job/find-parts",
  "/hcp/jobs",
  "/hcp/leads",
  "/hcp/payments",
  "/hcp/pricebook",
  "/hcp/service-plans",
  "/hcp/tags",
  "/hcp/webhook-events",
  "/history",
  "/knowledge",
  "/marcone-parts",
  "/marcone-parts/cart",
  "/marcone-parts/orders",
  "/marcone-parts/part-detail",
  "/marcone-parts/return-request",
  "/marcone-parts/search",
  "/messages",
  "/models",
  "/models/[id]",
  "/new-diagnosis",
  "/parts",
  "/parts/[id]",
  "/parts/analytics",
  "/parts/canvas",
  "/parts/catalog-scan",
  "/parts/global-search",
  "/parts/orders",
  "/parts/scan",
  "/parts/transfer",
  "/parts/van",
  "/profile-details",
  "/session/[id]",
  "/symptoms",
  "/tech-sheet-viewer",
  "/tools-supplies",
  "/tree-editor",
  "/union-parts",
] as const;

export type ReferenceRoute = (typeof REFERENCE_ROUTES)[number];
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

type ParityDraft = Omit<ParityMapping, "referenceCommit" | "componentHash">;
type ParityHashInput = Omit<ParityMapping, "componentHash">;

export const PARITY_STATES = Object.freeze([
  "default",
  "loading",
  "empty",
  "error",
  "offline",
  "reduced-motion",
] as const satisfies readonly ParityState[]);

const PUBLIC = Object.freeze(["public"] as const satisfies readonly ParityRole[]);
const STAFF = Object.freeze(["admin", "driver"] as const satisfies readonly ParityRole[]);
const ADMIN = Object.freeze(["admin"] as const satisfies readonly ParityRole[]);
const CUSTOMER = Object.freeze(["customer"] as const satisfies readonly ParityRole[]);
const AUTHENTICATED = Object.freeze(["admin", "driver", "customer"] as const satisfies readonly ParityRole[]);

const AUTH_COMPONENTS = ["Screen", "Header", "TextField", "AnimatedButton", "StateViews"] as const;
const RECORD_COMPONENTS = ["Screen", "Header", "WorkspaceCard", "StatusBadge", "StateViews"] as const;
const MARKET_COMPONENTS = [
  "Screen",
  "Header",
  "HorizontalCarousel",
  "WorkspaceCard",
  "AnimatedButton",
  "Sheet",
  "StateViews",
] as const;
const DETAIL_COMPONENTS = [
  "Screen",
  "Header",
  "WorkspaceCard",
  "Timeline",
  "StatusBadge",
  "Sheet",
  "StateViews",
] as const;
const SEARCH_COMPONENTS = [
  "Screen",
  "Header",
  "TextField",
  "SegmentedControl",
  "AnimatedCard",
  "StateViews",
] as const;
const ADMIN_COMPONENTS = [
  "Screen",
  "Header",
  "SegmentedControl",
  "WorkspaceCard",
  "List",
  "StatusBadge",
  "Drawer",
  "StateViews",
] as const;

const drafts = [
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
  route("/(tabs)/inventory", "/(tabs)/inventory", STAFF, [
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

  route("/encompass-parts", "/capacity-marketplace", STAFF, MARKET_COMPONENTS),
  route("/encompass-parts/cart", "/capacity-marketplace/cart", STAFF, [
    "Screen",
    "Header",
    "List",
    "AnimatedButton",
    "StateViews",
  ]),
  route("/encompass-parts/orders", "/capacity-marketplace/orders", STAFF, RECORD_COMPONENTS),
  route("/encompass-parts/part-detail", "/capacity-marketplace/capacity-detail", STAFF, DETAIL_COMPONENTS),
  route("/encompass-parts/return-request", "/capacity-marketplace/release-request", STAFF, [
    "Screen",
    "Header",
    "TextField",
    "AnimatedButton",
    "StateViews",
  ]),
  route("/encompass-parts/search", "/capacity-marketplace/search", STAFF, SEARCH_COMPONENTS),

  route("/error-codes", "/exception-codes", STAFF, [
    "Screen",
    "Header",
    "TextField",
    "SegmentedControl",
    "List",
    "StateViews",
  ]),
  route("/error-codes/[id]", "/exception-codes/[id]", STAFF, DETAIL_COMPONENTS),

  route("/hcp", "/operations", ADMIN, ADMIN_COMPONENTS),
  route("/hcp/customer/[id]", "/customers/[id]", ADMIN, DETAIL_COMPONENTS),
  route("/hcp/customers", "/customers", ADMIN, ADMIN_COMPONENTS),
  route("/hcp/employees", "/team", ADMIN, ADMIN_COMPONENTS),
  route("/hcp/estimates", "/quotes", ADMIN, ADMIN_COMPONENTS),
  route("/hcp/invoices", "/invoices", ADMIN, ADMIN_COMPONENTS),
  route("/hcp/job/[id]", "/load/[id]", STAFF, DETAIL_COMPONENTS),
  route("/hcp/job/find-parts", "/capacity-marketplace/search", STAFF, SEARCH_COMPONENTS),
  route("/hcp/jobs", "/loads", STAFF, ADMIN_COMPONENTS),
  route("/hcp/leads", "/leads", ADMIN, ADMIN_COMPONENTS),
  route("/hcp/payments", "/payments", ADMIN, ADMIN_COMPONENTS),
  route("/hcp/pricebook", "/rate-book", ADMIN, ADMIN_COMPONENTS),
  route("/hcp/service-plans", "/service-programs", ADMIN, ADMIN_COMPONENTS),
  route("/hcp/tags", "/tags", ADMIN, ADMIN_COMPONENTS),
  route("/hcp/webhook-events", "/integration-events", ADMIN, [
    "Screen",
    "Header",
    "SegmentedControl",
    "Timeline",
    "StatusBadge",
    "StateViews",
  ]),

  route("/history", "/history", AUTHENTICATED, [
    "Screen",
    "Header",
    "SegmentedControl",
    "Timeline",
    "StatusBadge",
    "StateViews",
  ]),
  route("/knowledge", "/knowledge", AUTHENTICATED, SEARCH_COMPONENTS),

  route("/marcone-parts", "/equipment-marketplace", STAFF, MARKET_COMPONENTS),
  route("/marcone-parts/cart", "/equipment-marketplace/cart", STAFF, [
    "Screen",
    "Header",
    "List",
    "AnimatedButton",
    "StateViews",
  ]),
  route("/marcone-parts/orders", "/equipment-marketplace/orders", STAFF, RECORD_COMPONENTS),
  route("/marcone-parts/part-detail", "/equipment-marketplace/equipment-detail", STAFF, DETAIL_COMPONENTS),
  route("/marcone-parts/return-request", "/equipment-marketplace/return-request", STAFF, [
    "Screen",
    "Header",
    "TextField",
    "AnimatedButton",
    "StateViews",
  ]),
  route("/marcone-parts/search", "/equipment-marketplace/search", STAFF, SEARCH_COMPONENTS),

  route("/messages", "/messages", AUTHENTICATED, [
    "Screen",
    "Header",
    "List",
    "TextField",
    "StatusBadge",
    "StateViews",
  ]),
  route("/models", "/equipment", STAFF, RECORD_COMPONENTS),
  route("/models/[id]", "/equipment/[id]", STAFF, DETAIL_COMPONENTS),
  route("/new-diagnosis", "/exception/new", STAFF, [
    "Screen",
    "Header",
    "TextField",
    "AnimatedButton",
    "Sheet",
    "StateViews",
  ]),

  route("/parts", "/capacity", STAFF, [
    ...RECORD_COMPONENTS,
    "SegmentedControl",
    "Drawer",
  ]),
  route("/parts/[id]", "/capacity/[id]", STAFF, DETAIL_COMPONENTS),
  route("/parts/analytics", "/capacity/analytics", ADMIN, [
    "Screen",
    "Header",
    "SegmentedControl",
    "WorkspaceCard",
    "StateViews",
  ]),
  route("/parts/canvas", "/capacity/planner", STAFF, [
    "Screen",
    "Header",
    "AnimatedCard",
    "Drawer",
    "Sheet",
    "StateViews",
  ]),
  route("/parts/catalog-scan", "/capacity/document-scan", STAFF, [
    "Screen",
    "Header",
    "GlassCard",
    "AnimatedButton",
    "StateViews",
  ]),
  route("/parts/global-search", "/capacity/search", STAFF, SEARCH_COMPONENTS),
  route("/parts/orders", "/capacity/orders", STAFF, RECORD_COMPONENTS),
  route("/parts/scan", "/capacity/scan", STAFF, [
    "Screen",
    "Header",
    "GlassCard",
    "AnimatedButton",
    "StateViews",
  ]),
  route("/parts/transfer", "/capacity/transfer", STAFF, [
    "Screen",
    "Header",
    "TextField",
    "AnimatedButton",
    "StatusBadge",
    "StateViews",
  ]),
  route("/parts/van", "/capacity/equipment", STAFF, RECORD_COMPONENTS),

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

function route(
  referenceRoute: ReferenceRoute,
  mfRoute: `/${string}`,
  roles: readonly ParityRole[],
  components: readonly ComponentFamily[],
): ParityDraft {
  return { referenceRoute, mfRoute, roles, states: PARITY_STATES, components };
}

/** Stable FNV-1a hash of the route's visual-component contract. */
export function componentHashFor(input: ParityHashInput): `fnv1a32:${string}` {
  const canonical = JSON.stringify({
    components: [...input.components].sort(),
    mfRoute: input.mfRoute,
    referenceCommit: input.referenceCommit,
    referenceRoute: input.referenceRoute,
    roles: [...input.roles].sort(),
    states: [...input.states].sort(),
  });
  let hash = 0x811c9dc5;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export const PARITY_MANIFEST: readonly ParityMapping[] = Object.freeze(
  drafts.map((draft) => {
    const mappingWithoutHash = {
      ...draft,
      referenceCommit: REFERENCE_COMMIT,
      roles: Object.freeze([...draft.roles]),
      states: Object.freeze([...draft.states]),
      components: Object.freeze([...draft.components]),
    } as const;
    return Object.freeze({
      ...mappingWithoutHash,
      componentHash: componentHashFor(mappingWithoutHash),
    });
  }),
);

/** Look up a single pinned-reference route without accepting generic slugs. */
export function getParityMapping(referenceRoute: ReferenceRoute): ParityMapping {
  const mapping = PARITY_MANIFEST.find((candidate) => candidate.referenceRoute === referenceRoute);
  if (!mapping) throw new RangeError(`Missing parity mapping for ${referenceRoute}`);
  return mapping;
}
