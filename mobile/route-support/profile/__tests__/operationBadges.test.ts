import { createDemoOperationsState, reanchorDemoState, DEMO_ACCOUNT_CREDENTIALS } from "@/domain/fixtures";
import { DemoOperationsRepository } from "@/store/DemoOperationsRepository";
import { MemoryPersistenceAdapter } from "@/store/persistence";
import { selectOperationBadges } from "../operationBadges";

const now = new Date("2026-08-20T13:00:00.000Z");

it("counts actionable fleet units, open jobs, maintenance and expiring documents", () => {
  const state = createDemoOperationsState();
  const snapshot = {
    ...state,
    vehicles: state.vehicles.map((v, i) => ({ ...v, status: i === 0 ? "retired" as const : "active" as const, assignedDriverId: undefined })),
    shipments: state.shipments.map((s, i) => ({ ...s, status: i === 0 ? "dispatched" as const : "delivered" as const })),
    maintenanceOrders: state.maintenanceOrders.map((o, i) => ({ ...o, status: i === 0 ? "open" as const : "completed" as const })),
    complianceDocuments: state.complianceDocuments.map((d, i) => ({ ...d, expiresOn: i === 0 ? "2026-08-19T00:00:00.000Z" : "2027-01-01T00:00:00.000Z" })),
  };
  expect(selectOperationBadges(snapshot, now)).toEqual({ fleet: state.vehicles.length - 1, jobs: 1, maintenance: 1, licensing: 1 });
});

it("returns zero for empty collections", () => {
  expect(selectOperationBadges({ vehicles: [], drivers: [], shipments: [], maintenanceOrders: [], complianceDocuments: [] }, now)).toEqual({ fleet: 0, jobs: 0, maintenance: 0, licensing: 0 });
});

it("updates job counts from real repository subscription events", async () => {
  const repository = new DemoOperationsRepository({ persistence: new MemoryPersistenceAdapter(), clock: () => now.toISOString() });
  await repository.hydrate();
  await repository.signIn(DEMO_ACCOUNT_CREDENTIALS.admin.email, DEMO_ACCOUNT_CREDENTIALS.admin.pin);
  const before = selectOperationBadges(repository.getState(), now).jobs;
  const counts: number[] = [];
  const unsubscribe = repository.subscribe((state) => counts.push(selectOperationBadges(state, now).jobs));
  await repository.addDemoUnassignedLoad();
  expect(counts.at(-1)).toBe(before + 1);
  unsubscribe();
});

it("renames the saved demo admin without losing session or operational changes", () => {
  const state = createDemoOperationsState();
  const saved = { ...state, accounts: state.accounts.map((a) => a.id === "account-admin" ? { ...a, displayName: "Morgan Brooks" } : a), shipments: state.shipments.slice(1) };
  const updated = reanchorDemoState(saved, now);
  expect(updated.accounts.find((a) => a.id === "account-admin")?.displayName).toBe("Marcus Ford");
  expect(updated.shipments).toEqual(saved.shipments);
  expect(updated.session).toEqual(saved.session);
});
