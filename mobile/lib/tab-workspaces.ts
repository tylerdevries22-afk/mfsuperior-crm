import type {
  AppRole,
  CreateCustomerRequestInput,
  EntityId,
  Shipment,
} from "@/domain/types";

export type ScheduleDateFilter = "today" | "upcoming" | "all";
export type ScheduleStatusFilter = "active" | "tenders" | "completed" | "all";

export interface ScheduleFilterOptions {
  readonly role: Extract<AppRole, "driver" | "admin">;
  readonly driverId?: EntityId;
  readonly date: ScheduleDateFilter;
  readonly status: ScheduleStatusFilter;
  readonly now: Date;
}

export interface CustomerRequestDraft {
  readonly type: CreateCustomerRequestInput["type"];
  readonly subject: string;
  readonly details: string;
  readonly shipmentId?: EntityId;
}

export interface CustomerRequestValidation {
  readonly subject?: string;
  readonly details?: string;
}

const COMPLETED_STATUSES = new Set<Shipment["status"]>([
  "delivered",
  "declined",
  "cancelled",
]);

function appointmentTime(shipment: Shipment): number {
  const timestamp = Date.parse(shipment.stops[0]?.appointment.startsAt ?? "");
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
}

function utcDayKey(date: Date): string {
  return [date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()].join("-");
}

function matchesDate(shipment: Shipment, filter: ScheduleDateFilter, now: Date): boolean {
  if (filter === "all") return true;
  const scheduledAt = new Date(appointmentTime(shipment));
  if (Number.isNaN(scheduledAt.getTime())) return false;
  if (filter === "today") return utcDayKey(scheduledAt) === utcDayKey(now);

  const startOfTomorrow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return scheduledAt.getTime() >= startOfTomorrow;
}

function matchesStatus(shipment: Shipment, filter: ScheduleStatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "tenders") return shipment.status === "tendered";
  if (filter === "completed") return COMPLETED_STATUSES.has(shipment.status);
  return shipment.status !== "tendered" && !COMPLETED_STATUSES.has(shipment.status);
}

/** Filter and chronologically sort the load board without mutating repository state. */
export function filterScheduleShipments(
  shipments: readonly Shipment[],
  options: ScheduleFilterOptions,
): readonly Shipment[] {
  return shipments
    .filter((shipment) => (
      options.role === "admin" || !options.driverId || shipment.assignedDriverId === options.driverId
    ))
    .filter((shipment) => matchesDate(shipment, options.date, options.now))
    .filter((shipment) => matchesStatus(shipment, options.status))
    .slice()
    .sort((left, right) => appointmentTime(left) - appointmentTime(right));
}

/** Return a deterministic, on-device assistant response for common freight questions. */
export function localAssistantReply(prompt: string, activeLoadId?: string): string {
  const normalized = prompt.trim().toLowerCase();
  const loadLabel = activeLoadId ? `Load ${activeLoadId}` : "The active load";

  if (!normalized) return "Enter a freight question and I’ll use the available freight records to guide you.";
  if (/exception|damage|delay|late|temperature/.test(normalized)) {
    return "Open Exception triage, document the condition and ETA, then notify operations. Offline actions remain queued until they sync.";
  }
  if (/hour|hos|clock|break|drive/.test(normalized)) {
    return "Review Hours of service before changing duty status. This app is not an ELD and cannot verify compliance.";
  }
  if (/target|edi|204|990|214|210|997/.test(normalized)) {
    return "Target is portal-available and still requires EDI onboarding. No production Target transport or credentials are configured.";
  }
  if (/load|shipment|stop|route|eta|where/.test(normalized)) {
    return `${loadLabel} is available in Schedule with its stop timeline, route plan, and status history.`;
  }
  if (/equipment|trailer|tractor|inventory|gear/.test(normalized)) {
    return "Open Capacity to review assigned tractors, trailers, securement gear, and service resources.";
  }
  return "I can help with loads, routes, HOS, exceptions, equipment, and partner onboarding status.";
}

/** Validate and normalize the customer request form before it reaches the repository. */
export function validateCustomerRequestDraft(
  draft: CustomerRequestDraft,
): CustomerRequestValidation {
  const subjectLength = draft.subject.trim().length;
  const detailsLength = draft.details.trim().length;

  return {
    subject: subjectLength < 4
      ? "Enter a subject with at least 4 characters."
      : subjectLength > 80 ? "Keep the subject to 80 characters or fewer." : undefined,
    details: detailsLength < 12
      ? "Add at least 12 characters of operational detail."
      : detailsLength > 500 ? "Keep the details to 500 characters or fewer." : undefined,
  };
}
