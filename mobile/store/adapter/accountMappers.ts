import type { Driver, IntegrationHealth, OperationsAccount } from "../../domain/types";
import { finiteCoordinate, titleForRole } from "./fieldCoercion";
import type { MobileBootstrapPayload, MobileDriverRow } from "./rowTypes";

/**
 * The signed-in account stays first so session resolution never depends on
 * directory ordering. Contacts carry no demo credentials.
 */
export function mergeContacts(
  account: OperationsAccount,
  bootstrap: MobileBootstrapPayload,
): readonly OperationsAccount[] {
  const contacts = bootstrap.referenceData.contacts ?? [];
  const merged: OperationsAccount[] = [account];
  for (const contact of contacts) {
    if (contact.id === account.id) continue;
    merged.push({
      companyName: bootstrap.organization.name,
      displayName: contact.displayName,
      email: contact.email,
      id: contact.id,
      role: contact.role,
      title: titleForRole(contact.role),
    });
  }
  return merged;
}

export function toDriver(row: MobileDriverRow): Driver {
  return {
    currentLocation: {
      latitude: finiteCoordinate(row.currentLat),
      longitude: finiteCoordinate(row.currentLng),
    },
    email: row.email ?? "",
    firstName: row.firstName,
    id: row.id,
    lastName: row.lastName,
    licenseClass: "A",
    licenseNumber: row.licenseNumber ?? "Pending",
    licenseState: row.licenseState ?? "CO",
    locationUpdatedAt: row.locationUpdatedAt ?? new Date(0).toISOString(),
    phone: row.phone ?? "",
    status: row.status,
  };
}

export function toIntegration(
  row: MobileBootstrapPayload["integrations"][number],
  now: string,
): IntegrationHealth {
  const status = row.status === "disabled" ? "not_configured" : row.status;
  return {
    id: row.provider,
    isSimulation: false,
    lastCheckedAt: row.lastSucceededAt ?? now,
    name: row.provider,
    status,
    summary: status === "connected" ? "Connection verified" : status === "degraded" ? "Connection requires attention" : "Credentials required",
  };
}
