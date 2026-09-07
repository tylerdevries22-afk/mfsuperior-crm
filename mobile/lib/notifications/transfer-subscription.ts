import { Platform } from "react-native";

import { getProductionAuthService } from "@/features/auth/runtime-service";
import { resolveAuthRuntimeConfig } from "@/lib/auth";

import {
  parseVehicleTransferNotification,
  type VehicleTransferNotification,
} from "./transfer-events";

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
