import { OperationsDomainError } from "./errors";
import type {
  GeoPoint,
  HosClock,
  HosDutyStatus,
  HosLimits,
  Shipment,
  ShipmentEvent,
  ShipmentEventSource,
  ShipmentEventType,
  ShipmentStatus,
  ShipmentStop,
} from "./types";

export const HOS_LIMITS: HosLimits = {
  drivingMinutes: 11 * 60,
  shiftMinutes: 14 * 60,
  cycleMinutes: 60 * 60,
  breakRequiredAfterMinutes: 8 * 60,
  qualifyingBreakMinutes: 30,
  dailyResetMinutes: 10 * 60,
  cycleResetMinutes: 34 * 60,
};

const SHIPMENT_TRANSITIONS: Readonly<Record<ShipmentStatus, readonly ShipmentStatus[]>> = {
  tendered: ["accepted", "declined", "cancelled"],
  accepted: ["dispatched", "cancelled"],
  declined: [],
  dispatched: ["at_pickup", "exception", "cancelled"],
  at_pickup: ["loaded", "exception", "cancelled"],
  loaded: ["in_transit", "exception", "cancelled"],
  in_transit: ["at_delivery", "exception", "cancelled"],
  at_delivery: ["delivered", "exception", "cancelled"],
  delivered: [],
  exception: ["dispatched", "at_pickup", "loaded", "in_transit", "at_delivery", "cancelled"],
  cancelled: [],
};

interface ShipmentTransitionDefinition {
  readonly eventType: ShipmentEventType;
  readonly eventCode: string;
  readonly description: string;
}

const SHIPMENT_EVENT_DEFINITIONS: Readonly<
  Partial<Record<ShipmentStatus, ShipmentTransitionDefinition>>
> = {
  accepted: {
    eventType: "tender_accepted",
    eventCode: "990",
    description: "Load tender accepted",
  },
  declined: {
    eventType: "tender_declined",
    eventCode: "990",
    description: "Load tender declined",
  },
  dispatched: {
    eventType: "dispatched",
    eventCode: "AF",
    description: "Driver dispatched",
  },
  at_pickup: {
    eventType: "arrived_at_pickup",
    eventCode: "X1",
    description: "Driver arrived at pickup",
  },
  loaded: {
    eventType: "loaded",
    eventCode: "X3",
    description: "Freight loaded and pickup completed",
  },
  in_transit: {
    eventType: "departed_pickup",
    eventCode: "D1",
    description: "Shipment in transit",
  },
  at_delivery: {
    eventType: "arrived_at_delivery",
    eventCode: "CD",
    description: "Driver arrived at delivery",
  },
  delivered: {
    eventType: "delivered",
    eventCode: "CL",
    description: "Shipment delivered",
  },
  exception: {
    eventType: "exception_reported",
    eventCode: "SD",
    description: "Shipment exception reported",
  },
  cancelled: {
    eventType: "cancelled",
    eventCode: "CA",
    description: "Shipment cancelled",
  },
};

export interface ShipmentTransitionContext {
  readonly eventId: string;
  readonly occurredAt: string;
  readonly source: ShipmentEventSource;
  readonly description?: string;
  readonly stopId?: string;
  readonly coordinates?: GeoPoint;
}

export interface HosTransitionContext {
  readonly entryId: string;
  readonly occurredAt: string;
  readonly locationDescription: string;
  readonly note?: string;
  readonly hasActiveShipment: boolean;
}

export function canTransitionShipment(
  currentStatus: ShipmentStatus,
  nextStatus: ShipmentStatus,
): boolean {
  return SHIPMENT_TRANSITIONS[currentStatus].includes(nextStatus);
}

export function transitionShipmentStatus(
  shipment: Shipment,
  nextStatus: ShipmentStatus,
  context: ShipmentTransitionContext,
): Shipment {
  if (!canTransitionShipment(shipment.status, nextStatus)) {
    throw new OperationsDomainError(
      "INVALID_TRANSITION",
      `A shipment cannot move from ${shipment.status} to ${nextStatus}.`,
      { shipmentId: shipment.id, currentStatus: shipment.status, nextStatus },
    );
  }

  const eventDefinition = SHIPMENT_EVENT_DEFINITIONS[nextStatus];
  if (!eventDefinition) {
    throw new OperationsDomainError(
      "INVALID_TRANSITION",
      "No shipment event is defined for this status change.",
      { nextStatus },
    );
  }

  const occurredAt = parseIsoDateTime(context.occurredAt, "occurredAt").toISOString();
  const updatedStops = updateStopsForShipmentStatus(shipment.stops, nextStatus, context.stopId, occurredAt);
  const event: ShipmentEvent = {
    id: context.eventId,
    shipmentId: shipment.id,
    type: eventDefinition.eventType,
    eventCode: eventDefinition.eventCode,
    source: context.source,
    occurredAt,
    description: context.description?.trim() || eventDefinition.description,
    resultingStatus: nextStatus,
    stopId: context.stopId,
    coordinates: context.coordinates,
    isSimulated: true,
  };

  return {
    ...shipment,
    status: nextStatus,
    stops: updatedStops,
    events: [...shipment.events, event],
    updatedAt: occurredAt,
  };
}

export function advanceHosClock(
  clock: HosClock,
  occurredAt: string,
  entryId: string,
  locationDescription: string,
  note?: string,
): HosClock {
  const startedAt = parseIsoDateTime(clock.statusStartedAt, "statusStartedAt");
  const endedAt = parseIsoDateTime(occurredAt, "occurredAt");
  const durationMinutes = Math.floor((endedAt.getTime() - startedAt.getTime()) / 60_000);

  if (durationMinutes < 0) {
    throw new OperationsDomainError(
      "VALIDATION_FAILED",
      "The HOS status time cannot move backward.",
      { driverId: clock.driverId },
    );
  }

  if (durationMinutes === 0) {
    return { ...clock, statusStartedAt: endedAt.toISOString() };
  }

  let drivingMinutesUsed = clock.drivingMinutesUsed;
  let shiftMinutesUsed = clock.shiftMinutesUsed;
  let cycleMinutesUsed = clock.cycleMinutesUsed;
  let minutesSinceQualifyingBreak = clock.minutesSinceQualifyingBreak;
  let offDutyMinutesToday = clock.offDutyMinutesToday;
  let breaksTakenToday = clock.breaksTakenToday;

  if (clock.status === "driving") {
    drivingMinutesUsed += durationMinutes;
    shiftMinutesUsed += durationMinutes;
    cycleMinutesUsed += durationMinutes;
    minutesSinceQualifyingBreak += durationMinutes;
  } else if (clock.status === "on_duty_not_driving") {
    shiftMinutesUsed += durationMinutes;
    cycleMinutesUsed += durationMinutes;
    minutesSinceQualifyingBreak += durationMinutes;
  } else {
    offDutyMinutesToday += durationMinutes;

    if (durationMinutes >= HOS_LIMITS.qualifyingBreakMinutes) {
      minutesSinceQualifyingBreak = 0;
      breaksTakenToday += 1;
    }

    if (durationMinutes >= HOS_LIMITS.dailyResetMinutes) {
      drivingMinutesUsed = 0;
      shiftMinutesUsed = 0;
      minutesSinceQualifyingBreak = 0;
    }

    if (durationMinutes >= HOS_LIMITS.cycleResetMinutes) {
      cycleMinutesUsed = 0;
    }
  }

  return {
    ...clock,
    statusStartedAt: endedAt.toISOString(),
    drivingMinutesUsed,
    shiftMinutesUsed,
    cycleMinutesUsed,
    minutesSinceQualifyingBreak,
    offDutyMinutesToday,
    breaksTakenToday,
    entries: [
      ...clock.entries,
      {
        id: entryId,
        driverId: clock.driverId,
        status: clock.status,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMinutes,
        locationDescription,
        note: note?.trim() || undefined,
        isSimulated: true,
      },
    ],
  };
}

export function transitionHosStatus(
  clock: HosClock,
  nextStatus: HosDutyStatus,
  context: HosTransitionContext,
): HosClock {
  if (clock.status === nextStatus) {
    throw new OperationsDomainError(
      "INVALID_TRANSITION",
      `The driver is already ${nextStatus.replaceAll("_", " ")}.`,
      { driverId: clock.driverId, status: nextStatus },
    );
  }

  const advancedClock = advanceHosClock(
    clock,
    context.occurredAt,
    context.entryId,
    context.locationDescription,
    context.note,
  );

  if (nextStatus === "driving") {
    assertDrivingIsAllowed(advancedClock, context.hasActiveShipment);
  }

  return {
    ...advancedClock,
    status: nextStatus,
  };
}

function assertDrivingIsAllowed(clock: HosClock, hasActiveShipment: boolean): void {
  if (!hasActiveShipment) {
    throw new OperationsDomainError(
      "INVALID_TRANSITION",
      "A driver needs an active dispatched load before starting Driving status.",
      { driverId: clock.driverId },
    );
  }

  if (clock.drivingMinutesUsed >= HOS_LIMITS.drivingMinutes) {
    throw new OperationsDomainError(
      "HOS_LIMIT_REACHED",
      "The 11-hour driving limit has been reached.",
      { driverId: clock.driverId, limitMinutes: HOS_LIMITS.drivingMinutes },
    );
  }

  if (clock.shiftMinutesUsed >= HOS_LIMITS.shiftMinutes) {
    throw new OperationsDomainError(
      "HOS_LIMIT_REACHED",
      "The 14-hour shift limit has been reached.",
      { driverId: clock.driverId, limitMinutes: HOS_LIMITS.shiftMinutes },
    );
  }

  if (clock.cycleMinutesUsed >= HOS_LIMITS.cycleMinutes) {
    throw new OperationsDomainError(
      "HOS_LIMIT_REACHED",
      "The 60-hour cycle limit has been reached.",
      { driverId: clock.driverId, limitMinutes: HOS_LIMITS.cycleMinutes },
    );
  }

  if (clock.minutesSinceQualifyingBreak >= HOS_LIMITS.breakRequiredAfterMinutes) {
    throw new OperationsDomainError(
      "BREAK_REQUIRED",
      "A 30-minute break is required before driving again.",
      { driverId: clock.driverId, breakMinutes: HOS_LIMITS.qualifyingBreakMinutes },
    );
  }
}

function updateStopsForShipmentStatus(
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

function parseIsoDateTime(value: string, fieldName: string): Date {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    throw new OperationsDomainError(
      "VALIDATION_FAILED",
      `${fieldName} must be a valid ISO date and time.`,
      { fieldName },
    );
  }
  return date;
}
