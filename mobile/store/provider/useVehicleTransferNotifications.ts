import { useEffect } from "react";

import type { OperationsRepository } from "../../domain/repository";
import type { DemoOperationsState } from "../../domain/types";
import {
  configureNotificationPresentation,
  registerDeviceForNotifications,
  showVehicleTransferNotification,
  subscribeToVehicleTransfers,
} from "../../lib/notifications/service";

/**
 * Push registration is a production-only, driver-only concern, so the effect
 * bails out before touching the device for demo sessions and dispatch users.
 */
export function useVehicleTransferNotifications(
  repository: OperationsRepository,
  state: DemoOperationsState,
  isHydrated: boolean,
): void {
  useEffect(() => {
    configureNotificationPresentation();
    const account = state.accounts.find((candidate) => candidate.id === state.session.accountId);
    const driverId = state.session.effectiveRole === "driver" ? account?.driverId : undefined;
    if (!isHydrated || repository.mode !== "production" || !driverId) return undefined;

    let cancelled = false;
    let unsubscribe: () => void = () => undefined;
    void registerDeviceForNotifications().catch(() => undefined);
    void subscribeToVehicleTransfers(driverId, (event) => {
      if (!cancelled) void showVehicleTransferNotification(event).catch(() => undefined);
    }).then((remove) => {
      if (cancelled) {
        remove();
      } else {
        unsubscribe = remove;
      }
    }).catch(() => undefined);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [isHydrated, repository.mode, state.accounts, state.session.accountId, state.session.effectiveRole]);
}
