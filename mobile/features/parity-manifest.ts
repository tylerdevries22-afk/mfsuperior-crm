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

  route("/hcp", "/operations", ADMIN, ADMIN_COMPONENTS),
  route("/hcp/customer/[id]", "/customers/[id]", ADMIN, DETAIL_COMPONENTS),
  route("/hcp/customers", "/customers", ADMIN, ADMIN_COMPONENTS),
  route("/hcp/employees", "/team", ADMIN, ADMIN_COMPONENTS),
  route("/hcp/estimates", "/quotes", ADMIN, ADMIN_COMPONENTS),
  route("/hcp/invoices", "/invoices", ADMIN, ADMIN_COMPONENTS),
  route("/hcp/job/[id]", "/load/[id]", STAFF, DETAIL_COMPONENTS),
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

/**
 * Reference routes deliberately not ported.
 *
 * The appliance app's parts inventory, appliance-model registry, and two
 * supplier storefronts were mirrored into freight as an equipment register,
 * equipment models, and two marketplaces. Freight operations here do not run
 * off an equipment inventory, so those screens described an industry this
 * product is not in. They are recorded rather than silently dropped: the
 * manifest is the parity contract, and a contract that quietly loses rows
 * stops being evidence.
 */
export const NOT_PORTED_ROUTES = [
  { referenceRoute: "/encompass-parts", formerMfRoute: "/capacity-marketplace" },
  { referenceRoute: "/encompass-parts/cart", formerMfRoute: "/capacity-marketplace/cart" },
  { referenceRoute: "/encompass-parts/orders", formerMfRoute: "/capacity-marketplace/orders" },
  { referenceRoute: "/encompass-parts/part-detail", formerMfRoute: "/capacity-marketplace/capacity-detail" },
  { referenceRoute: "/encompass-parts/return-request", formerMfRoute: "/capacity-marketplace/release-request" },
  { referenceRoute: "/encompass-parts/search", formerMfRoute: "/capacity-marketplace/search" },
  { referenceRoute: "/hcp/job/find-parts", formerMfRoute: "/capacity-marketplace/search" },
  { referenceRoute: "/marcone-parts", formerMfRoute: "/equipment-marketplace" },
  { referenceRoute: "/marcone-parts/cart", formerMfRoute: "/equipment-marketplace/cart" },
  { referenceRoute: "/marcone-parts/orders", formerMfRoute: "/equipment-marketplace/orders" },
  { referenceRoute: "/marcone-parts/part-detail", formerMfRoute: "/equipment-marketplace/equipment-detail" },
  { referenceRoute: "/marcone-parts/return-request", formerMfRoute: "/equipment-marketplace/return-request" },
  { referenceRoute: "/marcone-parts/search", formerMfRoute: "/equipment-marketplace/search" },
  { referenceRoute: "/models", formerMfRoute: "/equipment" },
  { referenceRoute: "/models/[id]", formerMfRoute: "/equipment/[id]" },
  { referenceRoute: "/parts", formerMfRoute: "/capacity" },
  { referenceRoute: "/parts/[id]", formerMfRoute: "/capacity/[id]" },
  { referenceRoute: "/parts/analytics", formerMfRoute: "/capacity/analytics" },
  { referenceRoute: "/parts/canvas", formerMfRoute: "/capacity/planner" },
  { referenceRoute: "/parts/catalog-scan", formerMfRoute: "/capacity/document-scan" },
  { referenceRoute: "/parts/global-search", formerMfRoute: "/capacity/search" },
  { referenceRoute: "/parts/orders", formerMfRoute: "/capacity/orders" },
  { referenceRoute: "/parts/scan", formerMfRoute: "/capacity/scan" },
  { referenceRoute: "/parts/transfer", formerMfRoute: "/capacity/transfer" },
  { referenceRoute: "/parts/van", formerMfRoute: "/capacity/equipment" },
] as const;

export const NOT_PORTED_REASON =
  "Equipment registry, equipment models, and parts marketplaces are appliance-service concepts with no freight analogue in this product.";
