import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useOperations } from "@/store";
import { useTheme } from "@/theme";
import type { Vehicle } from "@/domain/types";
export function useVehicleDetail() {
  const router = useRouter();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    actions,
    complianceDocuments,
    effectiveRole,
    maintenanceOrders,
    state,
    vehicles,
  } = useOperations();

  const [assigning, setAssigning] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [transferDriverId, setTransferDriverId] = useState<string | null>(null);
  const [transferNote, setTransferNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [thumbnailBusy, setThumbnailBusy] = useState(false);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);

  const vehicle = useMemo(
    () => vehicles.find((candidate) => candidate.id === id) ?? null,
    [id, vehicles],
  );
  const driver = useMemo(
    () => vehicle?.assignedDriverId
      ? state.drivers.find((candidate) => candidate.id === vehicle.assignedDriverId) ?? null
      : null,
    [state.drivers, vehicle],
  );
  const orders = useMemo(
    () => maintenanceOrders
      .filter((order) => order.vehicleId === id)
      .sort((left, right) => Date.parse(right.openedAt) - Date.parse(left.openedAt)),
    [id, maintenanceOrders],
  );
  const documents = useMemo(
    () => complianceDocuments
      .filter((document) => document.subjectType === "vehicle" && document.subjectId === id)
      .sort((left, right) => Date.parse(left.expiresOn) - Date.parse(right.expiresOn)),
    [complianceDocuments, id],
  );

  const assign = useCallback(async (driverId: string | null) => {
    if (!vehicle) {
      return;
    }
    setBusy(true);
    const assigned = await actions.assignVehicle(vehicle.id, driverId);
    setBusy(false);
    if (assigned) {
      setAssigning(false);
    }
  }, [actions, vehicle]);

  const transfer = useCallback(async () => {
    if (!vehicle || !transferDriverId) return;
    setBusy(true);
    const succeeded = await actions.transferVehicle(vehicle.id, transferDriverId, transferNote);
    setBusy(false);
    if (succeeded) {
      setTransferring(false);
      setTransferDriverId(null);
      setTransferNote("");
    }
  }, [actions, transferDriverId, transferNote, vehicle]);

  const chooseThumbnail = useCallback(async () => {
    if (!vehicle) return;
    setThumbnailError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setThumbnailError("Photo-library access is needed to add a vehicle thumbnail.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [4, 3],
        mediaTypes: ["images"],
        quality: 0.82,
      });
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset) return;
      setThumbnailBusy(true);
      const succeeded = await actions.updateVehicleThumbnail(vehicle.id, {
        contentType: thumbnailContentType(asset.mimeType, asset.fileName),
        fileName: asset.fileName ?? `unit-${vehicle.unitNumber}.jpg`,
        uri: asset.uri,
      });
      setThumbnailBusy(false);
      if (!succeeded) setThumbnailError("The vehicle thumbnail could not be saved. Try again.");
    } catch {
      setThumbnailBusy(false);
      setThumbnailError("The photo could not be added. Try another image.");
    }
  }, [actions, vehicle]);

  return { router, theme, effectiveRole, state, maintenanceOrders, vehicle, driver, orders, documents, assigning, setAssigning, transferring, setTransferring, transferDriverId, setTransferDriverId, transferNote, setTransferNote, busy, thumbnailBusy, thumbnailError, assign, transfer, chooseThumbnail };
}
function thumbnailContentType(mimeType: string | undefined, fileName: string | null | undefined): string {
  const normalized = mimeType?.toLowerCase();
  if (normalized === "image/heic" || normalized === "image/png" || normalized === "image/webp") {
    return normalized;
  }
  if (normalized === "image/jpeg") return normalized;
  return fileName?.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
}

export type VehicleDetailModel = ReturnType<typeof useVehicleDetail> & { vehicle: Vehicle };
