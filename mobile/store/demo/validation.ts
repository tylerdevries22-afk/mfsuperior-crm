import { OperationsDomainError } from "../../domain/errors";
import type { GeoPoint, IsoDateTime } from "../../domain/types";

export function validateCoordinates(coordinates: GeoPoint): void {
  if (
    !Number.isFinite(coordinates.latitude) ||
    !Number.isFinite(coordinates.longitude) ||
    coordinates.latitude < -90 ||
    coordinates.latitude > 90 ||
    coordinates.longitude < -180 ||
    coordinates.longitude > 180
  ) {
    throw new OperationsDomainError(
      "VALIDATION_FAILED",
      "The GPS coordinates are invalid.",
    );
  }
}

export function requireTrimmedText(
  value: string,
  fieldName: string,
  minimumLength: number,
  maximumLength: number,
): void {
  const length = value.trim().length;
  if (length < minimumLength || length > maximumLength) {
    throw new OperationsDomainError(
      "VALIDATION_FAILED",
      `${fieldName} must be between ${minimumLength} and ${maximumLength} characters.`,
      { fieldName, minimumLength, maximumLength },
    );
  }
}

export function normalizedIsoDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new OperationsDomainError(
      "VALIDATION_FAILED",
      "The demo clock returned an invalid date and time.",
    );
  }
  return date.toISOString();
}

export function addMinutes(value: IsoDateTime, minutes: number): IsoDateTime {
  return new Date(Date.parse(value) + minutes * 60_000).toISOString();
}
