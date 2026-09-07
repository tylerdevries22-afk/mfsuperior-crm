/**
 * Back-office operations routes ported from the reference `/hcp` tree.
 */

import type { ParityDraft } from "./types";
import { ADMIN, ADMIN_COMPONENTS, DETAIL_COMPONENTS, STAFF, route } from "./vocabulary";

export const OPERATIONS_DRAFTS = [
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
] as const satisfies readonly ParityDraft[];
