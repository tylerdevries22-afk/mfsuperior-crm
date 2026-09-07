import { OperationsDomainError } from "../errors";

export function parseIsoDateTime(value: string, fieldName: string): Date {
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
