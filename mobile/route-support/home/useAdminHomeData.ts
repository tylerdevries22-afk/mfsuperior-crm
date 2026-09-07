import { useRouter } from "expo-router";
import { useMemo } from "react";

import type { Shipment } from "@/domain/types";
import { formatDateKey, scheduledStart } from "@/route-support/schedule/utils";

const CLOSED = new Set(["delivered", "declined", "cancelled"]);

export interface AttentionItem {
  readonly key: string;
  readonly title: string;
  readonly hint: string;
  readonly onPress: () => void;
}

export interface AdminHomeData {
  readonly attention: readonly AttentionItem[];
  readonly delivered: number;
  readonly inTransit: number;
  readonly nextLoad: Shipment | undefined;
  readonly revenueCents: number;
  readonly todayLoads: readonly Shipment[];
}

/**
 * Everything the admin overview counts, derived in one place so the screen
 * itself stays a composition of cards. "Today" is the local day key, not a
 * rolling 24 hours, because that is the day a dispatcher is looking at.
 */
export function useAdminHomeData(
  shipments: readonly Shipment[],
  exceptions: readonly { status: string }[],
): AdminHomeData {
  const router = useRouter();

  const active = useMemo(
    () => shipments.filter((shipment) => !CLOSED.has(shipment.status)),
    [shipments],
  );
  const todayKey = formatDateKey(new Date());
  const todayLoads = useMemo(
    () =>
      shipments.filter((shipment) => {
        const start = scheduledStart(shipment);
        return start !== null && formatDateKey(new Date(start)) === todayKey;
      }),
    [shipments, todayKey],
  );
  const delivered = useMemo(
    () => todayLoads.filter((shipment) => shipment.status === "delivered").length,
    [todayLoads],
  );
  const inTransit = useMemo(
    () => active.filter((shipment) => shipment.status === "in_transit").length,
    [active],
  );
  const revenueCents = useMemo(
    () =>
      todayLoads.reduce(
        (total, { charges }) =>
          total + charges.linehaulCents + charges.fuelSurchargeCents + charges.accessorialsCents,
        0,
      ),
    [todayLoads],
  );

  const openExceptions = exceptions.filter((item) => item.status !== "resolved");
  const tenders = shipments.filter((shipment) => shipment.status === "tendered");
  const unassigned = active.filter((shipment) => !shipment.assignedDriverId);
  const firstUnassignedId = unassigned[0]?.id;

  const attention = useMemo(
    () =>
      [
        openExceptions.length > 0 && {
          hint: "Review and resolve before they affect delivery",
          key: "exceptions",
          onPress: () => router.push("/exception-diagnostic"),
          title: `${openExceptions.length} exception${openExceptions.length === 1 ? "" : "s"} open`,
        },
        tenders.length > 0 && {
          hint: "Accept or decline before the offer expires",
          key: "tenders",
          onPress: () => router.push("/(tabs)/schedule"),
          title: `${tenders.length} tender${tenders.length === 1 ? "" : "s"} awaiting response`,
        },
        unassigned.length > 0 && {
          hint: "Assign capacity to keep the lane on schedule",
          key: "unassigned",
          onPress: () => firstUnassignedId && router.push({ params: { id: firstUnassignedId }, pathname: "/job-assignment/[id]" }),
          title: `${unassigned.length} load${unassigned.length === 1 ? "" : "s"} without a driver`,
        },
      ].filter(Boolean) as readonly AttentionItem[],
    [firstUnassignedId, openExceptions.length, router, tenders.length, unassigned.length],
  );

  const nextLoad: Shipment | undefined = useMemo(
    () =>
      [...active]
        .filter((shipment) => scheduledStart(shipment) !== null)
        .sort((a, b) => (scheduledStart(a) ?? "").localeCompare(scheduledStart(b) ?? ""))[0],
    [active],
  );

  return { attention, delivered, inTransit, nextLoad, revenueCents, todayLoads };
}
