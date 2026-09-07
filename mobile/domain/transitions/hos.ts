import { OperationsDomainError } from "../errors";
import type { HosClock, HosDutyStatus, HosLimits } from "../types";
import { parseIsoDateTime } from "./time";

export const HOS_LIMITS: HosLimits = {
  drivingMinutes: 11 * 60,
  shiftMinutes: 14 * 60,
  cycleMinutes: 60 * 60,
  breakRequiredAfterMinutes: 8 * 60,
  qualifyingBreakMinutes: 30,
  dailyResetMinutes: 10 * 60,
  cycleResetMinutes: 34 * 60,
};

export interface HosTransitionContext {
  readonly entryId: string;
  readonly occurredAt: string;
  readonly locationDescription: string;
  readonly note?: string;
  readonly hasActiveShipment: boolean;
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
