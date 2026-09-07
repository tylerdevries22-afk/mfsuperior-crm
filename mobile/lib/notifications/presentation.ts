import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import {
  isRecord,
  markTransferEventSeen,
  transferEventId,
  type VehicleTransferNotification,
} from "./transfer-events";

let presentationConfigured = false;

export function configureNotificationPresentation(): void {
  if (presentationConfigured || Platform.OS === "web") return;
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const eventId = transferEventId(notification.request.content.data);
      const isLocalFallback = isRecord(notification.request.content.data) &&
        notification.request.content.data.localFallback === true;
      const shouldShow = isLocalFallback || (eventId ? markTransferEventSeen(eventId) : true);
      return {
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: shouldShow,
        shouldShowList: shouldShow,
      };
    },
  });
  presentationConfigured = true;
}

export async function showVehicleTransferNotification(
  event: VehicleTransferNotification,
): Promise<void> {
  if (Platform.OS === "web" || !markTransferEventSeen(event.eventId)) return;
  configureNotificationPresentation();
  const note = event.note ? ` ${event.note}` : "";
  await Notifications.scheduleNotificationAsync({
    content: {
      body: `Unit ${event.vehicleUnitNumber} is now assigned to you.${note}`,
      data: { eventId: event.eventId, localFallback: true, vehicleId: event.vehicleId },
      title: "Vehicle transferred",
    },
    trigger: null,
  });
}
