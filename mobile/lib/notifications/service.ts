/**
 * Composition root for native push notifications. Presentation, device
 * registration, token acquisition, and realtime transfer subscriptions live in
 * the sibling modules below; this file pins the public surface shared with
 * `./service.web.ts`.
 */
export type { VehicleTransferNotification } from "./transfer-events";
export {
  configureNotificationPresentation,
  showVehicleTransferNotification,
} from "./presentation";
export {
  registerDeviceForNotifications,
  unregisterDeviceForNotifications,
} from "./device-registration";
export { subscribeToVehicleTransfers } from "./transfer-subscription";
