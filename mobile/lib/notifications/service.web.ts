// Browser previews use the existing in-app activity feed. Avoid importing
// unsupported native push modules when mounting the demo on the web.
export type { VehicleTransferNotification } from "./service";

export function configureNotificationPresentation(): void { }
export async function registerDeviceForNotifications(): Promise<void> { }
export async function unregisterDeviceForNotifications(): Promise<void> { }
export async function showVehicleTransferNotification(): Promise<void> { }
export async function subscribeToVehicleTransfers(): Promise<() => void> {
  return () => undefined;
}
