import type { EntityId, GeoPoint, IsoDateTime } from "./core";

export type DriverAvailability = "available" | "on_duty" | "off_duty" | "suspended";

export interface Driver {
  readonly id: EntityId;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string;
  readonly licenseNumber: string;
  readonly licenseState: string;
  readonly licenseClass: "A";
  /** Portrait served by the API. Demo drivers fall back to a bundled asset. */
  readonly avatarUrl?: string;
  readonly status: DriverAvailability;
  readonly currentLocation: GeoPoint;
  readonly locationUpdatedAt: IsoDateTime;
}

export const HOS_DUTY_STATUSES = [
  "off_duty",
  "sleeper_berth",
  "driving",
  "on_duty_not_driving",
] as const;

export type HosDutyStatus = (typeof HOS_DUTY_STATUSES)[number];

export interface HosLogEntry {
  readonly id: EntityId;
  readonly driverId: EntityId;
  readonly status: HosDutyStatus;
  readonly startedAt: IsoDateTime;
  readonly endedAt: IsoDateTime;
  readonly durationMinutes: number;
  readonly locationDescription: string;
  readonly note?: string;
  readonly isSimulated: boolean;
}

export interface HosClock {
  readonly driverId: EntityId;
  readonly status: HosDutyStatus;
  readonly statusStartedAt: IsoDateTime;
  readonly drivingMinutesUsed: number;
  readonly shiftMinutesUsed: number;
  readonly cycleMinutesUsed: number;
  readonly minutesSinceQualifyingBreak: number;
  readonly offDutyMinutesToday: number;
  readonly breaksTakenToday: number;
  readonly entries: readonly HosLogEntry[];
}

export interface HosLimits {
  readonly drivingMinutes: number;
  readonly shiftMinutes: number;
  readonly cycleMinutes: number;
  readonly breakRequiredAfterMinutes: number;
  readonly qualifyingBreakMinutes: number;
  readonly dailyResetMinutes: number;
  readonly cycleResetMinutes: number;
}
