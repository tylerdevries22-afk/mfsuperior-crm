import { OperationsDomainError } from "../errors";
import type { ShipmentStatus, ShipmentStop } from "../types";

export function updateStopsForShipmentStatus(
  stops: readonly ShipmentStop[],
  nextStatus: ShipmentStatus,
  requestedStopId: string | undefined,
  occurredAt: string,
): readonly ShipmentStop[] {
  if (nextStatus === "at_pickup") {
    const pickup = stops.find((stop) => stop.type === "pickup");
    return updateRequiredStop(stops, pickup, requestedStopId, "arrived", occurredAt);
  }

  if (nextStatus === "loaded") {
    const pickup = stops.find((stop) => stop.type === "pickup");
    if (pickup?.status !== "arrived") {
      throw new OperationsDomainError(
        "INVALID_TRANSITION",
        "The pickup stop must be marked arrived before loading.",
      );
    }
    return updateRequiredStop(stops, pickup, requestedStopId, "completed", occurredAt);
  }

  if (nextStatus === "at_delivery") {
    const delivery = [...stops].reverse().find((stop) => stop.type === "delivery");
    const unfinishedPriorStop = stops.find(
      (stop) => stop.id !== delivery?.id && stop.status !== "completed" && stop.status !== "skipped",
    );
    if (unfinishedPriorStop) {
      throw new OperationsDomainError(
        "INVALID_TRANSITION",
        "All earlier route stops must be completed before delivery arrival.",
        { stopId: unfinishedPriorStop.id },
      );
    }
    return updateRequiredStop(stops, delivery, requestedStopId, "arrived", occurredAt);
  }

  if (nextStatus === "delivered") {
    const delivery = [...stops].reverse().find((stop) => stop.type === "delivery");
    if (delivery?.status !== "arrived") {
      throw new OperationsDomainError(
        "INVALID_TRANSITION",
        "The delivery stop must be marked arrived before proof of delivery is submitted.",
      );
    }
    return updateRequiredStop(stops, delivery, requestedStopId, "completed", occurredAt);
  }

  return stops;
}

function updateRequiredStop(
  stops: readonly ShipmentStop[],
  stop: ShipmentStop | undefined,
  requestedStopId: string | undefined,
  status: "arrived" | "completed",
  occurredAt: string,
): readonly ShipmentStop[] {
  if (!stop) {
    throw new OperationsDomainError("INVALID_TRANSITION", "The required route stop is missing.");
  }

  if (requestedStopId && requestedStopId !== stop.id) {
    throw new OperationsDomainError(
      "INVALID_TRANSITION",
      "The selected stop does not match the next required route stop.",
      { stopId: requestedStopId, requiredStopId: stop.id },
    );
  }

  return stops.map((candidate) => {
    if (candidate.id !== stop.id) {
      return candidate;
    }

    return status === "arrived"
      ? { ...candidate, status, arrivedAt: occurredAt }
      : { ...candidate, status, completedAt: occurredAt };
  });
}
