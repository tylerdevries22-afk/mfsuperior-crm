import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { randomUUID } from "expo-crypto";
import { Platform } from "react-native";

import { getProductionAuthService } from "@/features/auth/runtime-service";
import { ApiClient } from "@/lib/network";
import { resolveAuthRuntimeConfig } from "@/lib/auth";

import { configureNotificationPresentation } from "./presentation";
import { expoPushToken } from "./push-token";

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
  const token = await expoPushToken(projectId);
  if (!token) return;
  const apiClient = new ApiClient({
    baseUrl: runtime.config.apiBaseUrl,
    getAccessToken: () => service.getAccessToken(),
  });
  await apiClient.requestJson("v1/notification-tokens", {
    body: { platform: Platform.OS, token },
    idempotencyKey: randomUUID(),
    method: "POST",
  });
}

/** Best-effort server-side token removal that runs before local sign-out. */
export async function unregisterDeviceForNotifications(): Promise<void> {
  if (Platform.OS === "web") return;
  const service = getProductionAuthService();
  const runtime = resolveAuthRuntimeConfig();
  if (!service || runtime.mode !== "production") return;

  const permissions = await Notifications.getPermissionsAsync();
  const hasPermission = permissions.granted ||
    permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!hasPermission || !projectId) return;

  const token = await expoPushToken(projectId);
  if (!token) return;
  const apiClient = new ApiClient({
    baseUrl: runtime.config.apiBaseUrl,
    getAccessToken: () => service.getAccessToken(),
  });
  await apiClient.requestJson("v1/notification-tokens", {
    body: { platform: Platform.OS, token },
    method: "DELETE",
  });
}
