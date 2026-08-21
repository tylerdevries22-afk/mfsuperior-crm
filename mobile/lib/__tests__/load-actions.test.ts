import { loadLifecycleAction } from "../load-actions";

describe("loadLifecycleAction", () => {
  it("keeps customer load details read-only", () => {
    expect(loadLifecycleAction("dispatched", "customer")).toBeNull();
  });

  it("allows only dispatch to dispatch an accepted load", () => {
    expect(loadLifecycleAction("accepted", "driver")).toBeNull();
    expect(loadLifecycleAction("accepted", "dispatcher")?.nextStatus).toBe("dispatched");
  });

  it("maps driver milestones to the next valid status", () => {
    expect(loadLifecycleAction("dispatched", "driver")?.nextStatus).toBe("at_pickup");
    expect(loadLifecycleAction("loaded", "driver")?.nextStatus).toBe("in_transit");
    expect(loadLifecycleAction("at_delivery", "driver")?.kind).toBe("proof_of_delivery");
  });

  it("does not offer direct actions for terminal or exception states", () => {
    expect(loadLifecycleAction("delivered", "dispatcher")).toBeNull();
    expect(loadLifecycleAction("exception", "dispatcher")).toBeNull();
  });
});
