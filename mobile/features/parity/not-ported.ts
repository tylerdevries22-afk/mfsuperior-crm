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
