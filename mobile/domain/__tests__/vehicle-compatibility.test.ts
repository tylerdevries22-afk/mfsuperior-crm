import { createDemoOperationsState, reanchorDemoState } from "../fixtures";
import { normalizeVehicle, vehicleTypeForApi } from "../vehicleCompatibility";

it("normalizes legacy powered units while preserving assignment and image data", () => {
  const unit = createDemoOperationsState().vehicles[0];
  if (!unit) throw new Error("Missing fixture unit");
  expect(normalizeVehicle({ ...unit, type: "tractor" })).toEqual({ ...unit, type: "truck" });
  expect(normalizeVehicle(unit)).toBe(unit);
});

it("keeps the existing backend wire values compatible", () => {
  expect(vehicleTypeForApi("truck")).toBe("tractor");
  expect(vehicleTypeForApi("trailer")).toBe("trailer");
});

it("keeps freshly stored current demo state unchanged on the same day", () => {
  const state = createDemoOperationsState();
  expect(reanchorDemoState(state, new Date("2026-08-20T13:00:00Z"))).toBe(state);
});
