import type { ShipmentStatus } from "@/domain/types";
import { LOAD_FLOW_STEPS, loadStepStates } from "../_components/LoadFlowBar";

const keys = LOAD_FLOW_STEPS.map((step) => step.key);

describe("load flow bar states", () => {
  it("completes everything before the current status and leaves the rest upcoming", () => {
    const states = loadStepStates("in_transit");
    const current = keys.indexOf("in_transit");
    keys.forEach((key, index) => {
      if (index < current) expect(states[key]).toBe("completed");
      else if (index === current) expect(states[key]).toBe("active");
      else expect(states[key]).toBe("upcoming");
    });
  });

  it("marks exactly one step active for every in-flight status", () => {
    const inFlight: ShipmentStatus[] = [
      "tendered",
      "accepted",
      "dispatched",
      "at_pickup",
      "loaded",
      "in_transit",
      "at_delivery",
    ];
    for (const status of inFlight) {
      const states = loadStepStates(status);
      const active = keys.filter((key) => states[key] === "active");
      expect(active).toEqual([status]);
    }
  });

  it("shows a delivered load as fully complete", () => {
    const states = loadStepStates("delivered");
    expect(keys.every((key) => states[key] === "completed")).toBe(true);
  });

  it("blocks the remaining steps for a load that will never continue", () => {
    for (const status of ["cancelled", "declined"] as ShipmentStatus[]) {
      const states = loadStepStates(status);
      expect(states[keys[0]]).toBe("completed");
      expect(keys.slice(1).every((key) => states[key] === "blocked")).toBe(true);
      expect(keys.some((key) => states[key] === "active")).toBe(false);
    }
  });

  it("blocks every step while a load is in exception", () => {
    const states = loadStepStates("exception");
    expect(keys.every((key) => states[key] === "blocked")).toBe(true);
  });

  it("covers every step key it renders", () => {
    const states = loadStepStates("dispatched");
    expect(Object.keys(states).sort()).toEqual([...keys].sort());
  });
});
