/**
 * Composition root for the freight screen fixtures. The data lives in focused
 * sibling modules by feature area; this file pins the exported inventory so
 * consumers keep a single stable import path.
 */
export { DRIVERS_SPEC, LOADS_SPEC } from "./freight-screen-dispatch";
export {
  CONTRACTS_SPEC,
  PROSPECTS_SPEC,
  QUOTES_SPEC,
  RATES_SPEC,
  SHIPPERS_SPEC,
} from "./freight-screen-commercial";
export { INVOICES_SPEC, SETTLEMENTS_SPEC } from "./freight-screen-finance";
export {
  EDI_CODES_SPEC,
  INTEGRATION_EVENTS_SPEC,
  KNOWLEDGE_SPEC,
  TAGS_SPEC,
} from "./freight-screen-reference";
export { MARKETPLACE_DETAIL_SPEC, SHIPPER_DETAIL_SPEC } from "./freight-screen-detail";
export {
  CLAIM_FORM,
  NEW_LOAD_FORM,
  NEW_PROSPECT_FORM,
  RETURN_FORM,
} from "./freight-screen-forms";
