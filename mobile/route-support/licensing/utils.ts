import type {
  ComplianceDocument,
  ComplianceDocumentKind,
  Driver,
  EntityId,
  Vehicle,
} from "@/domain/types";

/**
 * Compliance expiry.
 *
 * Buckets are measured in whole days from local midnight so a document does
 * not flip between "expires today" and "expired" as the clock crosses noon.
 */

export const EXPIRY_BUCKETS = ["expired", "urgent", "soon", "ok"] as const;

export type ExpiryBucket = (typeof EXPIRY_BUCKETS)[number];

export const EXPIRY_BUCKET_LABELS: Record<ExpiryBucket, string> = {
  expired: "Expired",
  ok: "Current",
  soon: "Expires within 90 days",
  urgent: "Expires within 30 days",
};

export const DOCUMENT_KIND_LABELS: Record<ComplianceDocumentKind, string> = {
  annual_inspection: "Annual inspection",
  cdl: "CDL",
  hazmat_endorsement: "Hazmat endorsement",
  ifta: "IFTA",
  insurance: "Insurance",
  medical_card: "Medical card",
  registration: "Registration",
};

export interface ComplianceEntry {
  readonly document: ComplianceDocument;
  readonly subjectLabel: string;
  readonly daysRemaining: number;
  readonly bucket: ExpiryBucket;
}

/** Whole days from today to the expiry, negative once it has passed. */
export function daysUntil(expiresOn: string, now: Date = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const expiry = new Date(expiresOn);
  const expiryDay = new Date(
    expiry.getFullYear(),
    expiry.getMonth(),
    expiry.getDate(),
  ).getTime();
  return Math.round((expiryDay - today) / 86_400_000);
}

export function bucketFor(daysRemaining: number): ExpiryBucket {
  if (daysRemaining < 0) {
    return "expired";
  }
  if (daysRemaining <= 30) {
    return "urgent";
  }
  if (daysRemaining <= 90) {
    return "soon";
  }
  return "ok";
}

export function describeRemaining(daysRemaining: number): string {
  if (daysRemaining < 0) {
    const overdue = Math.abs(daysRemaining);
    return `Expired ${overdue} day${overdue === 1 ? "" : "s"} ago`;
  }
  if (daysRemaining === 0) {
    return "Expires today";
  }
  return `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left`;
}

/**
 * Every document with its subject resolved, sorted by urgency. What is already
 * expired leads, because it is the only category that grounds a truck today.
 */
export function buildComplianceEntries(
  documents: readonly ComplianceDocument[],
  vehicles: readonly Vehicle[],
  drivers: readonly Driver[],
  now: Date = new Date(),
): readonly ComplianceEntry[] {
  const vehicleNames = new Map<EntityId, string>(
    vehicles.map((vehicle) => [vehicle.id, `Unit ${vehicle.unitNumber}`]),
  );
  const driverNames = new Map<EntityId, string>(
    drivers.map((driver) => [driver.id, `${driver.firstName} ${driver.lastName}`]),
  );

  return documents
    .map((document) => {
      const daysRemaining = daysUntil(document.expiresOn, now);
      return {
        bucket: bucketFor(daysRemaining),
        daysRemaining,
        document,
        subjectLabel: (document.subjectType === "vehicle"
          ? vehicleNames.get(document.subjectId)
          : driverNames.get(document.subjectId)) ?? "Unknown",
      };
    })
    .sort((left, right) => left.daysRemaining - right.daysRemaining);
}

export function groupByBucket(
  entries: readonly ComplianceEntry[],
): readonly { readonly bucket: ExpiryBucket; readonly entries: readonly ComplianceEntry[] }[] {
  return EXPIRY_BUCKETS
    .map((bucket) => ({
      bucket,
      entries: entries.filter((entry) => entry.bucket === bucket),
    }))
    .filter((group) => group.entries.length > 0);
}

/** How many documents need attention now, for the badge on the Profile row. */
export function countNeedingAttention(entries: readonly ComplianceEntry[]): number {
  return entries.filter((entry) => entry.bucket === "expired" || entry.bucket === "urgent").length;
}
