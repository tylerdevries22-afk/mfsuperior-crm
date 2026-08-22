import { CORRIDORS, FLEET, fleetPositions, pointAt } from "../fleet-simulation";
import { nearest, next } from "../_components/MapBottomSheet";

const COLORADO = {
  minLat: 36.99,
  maxLat: 41.0,
  minLng: -109.06,
  maxLng: -102.04,
};

describe("corridor interpolation", () => {
  it("returns the endpoints at the ends of the line", () => {
    const line = CORRIDORS.i25;
    expect(pointAt(line, 0)).toEqual(line[0]);
    // Progress wraps, so 1 is the start again rather than the final vertex.
    expect(pointAt(line, 1)).toEqual(line[0]);
  });

  it("lands on the segment between two vertices", () => {
    const line = [
      { latitude: 0, longitude: 0 },
      { latitude: 10, longitude: 20 },
    ];
    expect(pointAt(line, 0.5)).toEqual({ latitude: 5, longitude: 10 });
    expect(pointAt(line, 0.25)).toEqual({ latitude: 2.5, longitude: 5 });
  });

  it("wraps instead of pinning to the last vertex", () => {
    const line = CORRIDORS.i70;
    expect(pointAt(line, 1.25)).toEqual(pointAt(line, 0.25));
    expect(pointAt(line, -0.75)).toEqual(pointAt(line, 0.25));
  });

  it("survives degenerate corridors", () => {
    expect(pointAt([], 0.5)).toEqual({ latitude: 0, longitude: 0 });
    const single = [{ latitude: 39, longitude: -105 }];
    expect(pointAt(single, 0.7)).toEqual(single[0]);
  });
});

describe("the demo fleet", () => {
  it("is three yellow and two white trucks", () => {
    const yellow = FLEET.filter((unit) => unit.bodyColor === "yellow");
    const white = FLEET.filter((unit) => unit.bodyColor === "white");
    expect(yellow).toHaveLength(3);
    expect(white).toHaveLength(2);
    expect(FLEET).toHaveLength(5);
  });

  it("gives every truck a distinct driver and a real corridor", () => {
    const ids = FLEET.map((unit) => unit.driverId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const unit of FLEET) {
      expect(CORRIDORS[unit.corridor]).toBeDefined();
      expect(unit.speed).toBeGreaterThan(0);
    }
  });

  it("keeps every truck inside Colorado for a full day of simulation", () => {
    // Positions wrap along their corridor, so no amount of elapsed time should
    // ever walk a truck out of the state the map is framed on.
    for (const seconds of [0, 30, 600, 3600, 86_400]) {
      const positions = fleetPositions(seconds);
      expect(Object.keys(positions)).toHaveLength(FLEET.length);
      for (const point of Object.values(positions)) {
        expect(point.latitude).toBeGreaterThanOrEqual(COLORADO.minLat);
        expect(point.latitude).toBeLessThanOrEqual(COLORADO.maxLat);
        expect(point.longitude).toBeGreaterThanOrEqual(COLORADO.minLng);
        expect(point.longitude).toBeLessThanOrEqual(COLORADO.maxLng);
      }
    }
  });

  it("actually moves between ticks", () => {
    const start = fleetPositions(0);
    const later = fleetPositions(5);
    for (const unit of FLEET) {
      const a = start[unit.driverId];
      const b = later[unit.driverId];
      const delta = Math.abs(a.latitude - b.latitude) + Math.abs(a.longitude - b.longitude);
      expect(delta).toBeGreaterThan(0);
    }
  });
});

describe("sheet snap resolution", () => {
  const SCREEN = 874;
  const MAX = 820;

  it("can always step back down from the top", () => {
    // The reported bug: once raised there was no way back. Whatever the
    // expanded height resolves to, stepping down must reach a smaller snap.
    expect(next("expanded", "down")).toBe("half");
    expect(next("half", "down")).toBe("collapsed");
    expect(next("collapsed", "down")).toBe("collapsed");
  });

  it("steps up through every position without skipping", () => {
    expect(next("collapsed", "up")).toBe("half");
    expect(next("half", "up")).toBe("expanded");
    expect(next("expanded", "up")).toBe("expanded");
  });

  it("resolves a dragged height to the closest snap", () => {
    expect(nearest(SCREEN * 0.08, SCREEN, MAX)).toBe("collapsed");
    expect(nearest(SCREEN * 0.5, SCREEN, MAX)).toBe("half");
    expect(nearest(MAX, SCREEN, MAX)).toBe("expanded");
  });

  it("still resolves expanded when the cap is below the raw ratio", () => {
    // The cap is what keeps the grab handle clear of the status bar, so a
    // capped expanded height must still read as "expanded".
    const cappedMax = SCREEN * 0.7;
    expect(nearest(cappedMax, SCREEN, cappedMax)).toBe("expanded");
    expect(next(nearest(cappedMax, SCREEN, cappedMax), "down")).toBe("half");
  });
});
