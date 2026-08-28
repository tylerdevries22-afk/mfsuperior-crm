import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { randomUUID } from "expo-crypto";
import { Platform } from "react-native";

import { getProductionAuthService } from "@/features/auth/runtime-service";
import { ApiClient } from "@/lib/network";
import { resolveAuthRuntimeConfig } from "@/lib/auth";

export interface VehicleTransferNotification {
  readonly eventId: string;
  readonly fromDriverName: string | null;
  readonly note: string;
  readonly targetDriverName: string;
  readonly vehicleId: string;
  readonly vehicleUnitNumber: string;
}

let presentationConfigured = false;
const seenTransferEvents = new Set<string>();

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

export async function registerDeviceForNotifications(): Promise<void> {
  if (Platform.OS === "web") return;
  configureNotificationPresentation();
  const service = getProductionAuthService();
  const runtime = resolveAuthRuntimeConfig();
  if (!service || runtime.mode !== "production") return;

  let permissions = await Notifications.getPermissionsAsync();
  const isGranted = permissions.granted ||
    permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (!isGranted && permissions.status === Notifications.PermissionStatus.UNDETERMINED) {
    permissions = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
  }
  const hasPermission = permissions.granted ||
    permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (!hasPermission) return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return;
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  const apiClient = new ApiClient({
    baseUrl: runtime.config.apiBaseUrl,
    getAccessToken: () => service.getAccessToken(),
  });
  await apiClient.requestJson("v1/notification-tokens", {
    body: { platform: Platform.OS, token: token.data },
    idempotencyKey: randomUUID(),
    method: "POST",
  });
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

export async function subscribeToVehicleTransfers(
  driverId: string,
  onTransfer: (event: VehicleTransferNotification) => void,
): Promise<() => void> {
  if (Platform.OS === "web") return () => undefined;
  const service = getProductionAuthService();
  const runtime = resolveAuthRuntimeConfig();
  if (!service || runtime.mode !== "production") return () => undefined;
  const accessToken = await service.getAccessToken();
  if (!accessToken) return () => undefined;

  const client = service.getClient();
  client.realtime.setAuth(accessToken);
  const channel = client
    .channel(`vehicle-transfers:${driverId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        filter: `target_driver_id=eq.${driverId}`,
        schema: "public",
        table: "vehicle_transfer_events",
      },
      (payload) => {
        const event = parseVehicleTransferNotification(payload.new);
        if (event) onTransfer(event);
      },
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

function parseVehicleTransferNotification(value: unknown): VehicleTransferNotification | null {
  if (!isRecord(value)) return null;
  const eventId = stringValue(value.id);
  const vehicleId = stringValue(value.vehicle_id);
  const vehicleUnitNumber = stringValue(value.vehicle_unit_number);
  const targetDriverName = stringValue(value.target_driver_name);
  if (!eventId || !vehicleId || !vehicleUnitNumber || !targetDriverName) return null;
  return {
    eventId,
    fromDriverName: nullableStringValue(value.from_driver_name),
    note: stringValue(value.note) ?? "",
    targetDriverName,
    vehicleId,
    vehicleUnitNumber,
  };
}

function transferEventId(value: unknown): string | null {
  return isRecord(value) ? stringValue(value.eventId) : null;
}

function markTransferEventSeen(eventId: string): boolean {
  if (seenTransferEvents.has(eventId)) return false;
  seenTransferEvents.add(eventId);
  return true;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function nullableStringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
