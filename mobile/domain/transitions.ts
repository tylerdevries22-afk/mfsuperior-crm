/**
 * Shipment and hours-of-service transition rules, grouped by entity area.
 * Split from a single 419-line module; the public surface is unchanged.
 */
export { HOS_LIMITS, advanceHosClock, transitionHosStatus } from "./transitions/hos";
export type { HosTransitionContext } from "./transitions/hos";
export { canTransitionShipment, transitionShipmentStatus } from "./transitions/shipments";
export type { ShipmentTransitionContext } from "./transitions/shipments";
