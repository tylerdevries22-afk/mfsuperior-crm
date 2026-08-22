import type { GeoPoint } from "@/domain/types";

/**
 * Demo-only movement for the HQ map.
 *
 * This exists so a demo workspace shows a fleet that is actually moving. It is
 * never used against production data: real positions arrive through
 * `recordDriverLocation`, and drawing invented coordinates on an operations map
 * would be a lie about where someone's truck is. `useFleetSimulation` refuses
 * to run outside demo mode for that reason.
 */

export type Corridor = readonly GeoPoint[];

/** Colorado's freight spine, as coarse polylines. */
export const CORRIDORS: Readonly<Record<string, Corridor>> = {
  /** I-25: Fort Collins → Denver → Colorado Springs → Pueblo. */
  i25: [
    { latitude: 40.5853, longitude: -105.0844 },
    { latitude: 40.1672, longitude: -105.1019 },
    { latitude: 39.7392, longitude: -104.9903 },
    { latitude: 39.3722, longitude: -104.8561 },
    { latitude: 38.8339, longitude: -104.8214 },
    { latitude: 38.2544, longitude: -104.6091 },
  ],
  /** I-70: Denver → Idaho Springs → Vail → Glenwood → Grand Junction. */
  i70: [
    { latitude: 39.7392, longitude: -104.9903 },
    { latitude: 39.7425, longitude: -105.5136 },
    { latitude: 39.6403, longitude: -106.3742 },
    { latitude: 39.5501, longitude: -107.3248 },
    { latitude: 39.0639, longitude: -108.5506 },
  ],
  /** US-50: Pueblo → Cañon City → Salida → Montrose. */
  us50: [
    { latitude: 38.2544, longitude: -104.6091 },
    { latitude: 38.4409, longitude: -105.2422 },
    { latitude: 38.5347, longitude: -105.9989 },
    { latitude: 38.4783, longitude: -107.8762 },
  ],
  /** E-470 / I-76 north-east out of Denver toward Fort Morgan. */
  i76: [
    { latitude: 39.7392, longitude: -104.9903 },
    { latitude: 39.8561, longitude: -104.6737 },
    { latitude: 40.0844, longitude: -104.2669 },
    { latitude: 40.2503, longitude: -103.8 },
  ],
};

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/**
 * Position along a corridor for `progress` in [0, 1). Values outside that range
 * wrap, so a truck that runs off the end reappears at the start rather than
 * pinning to the last vertex.
 */
export function pointAt(corridor: Corridor, progress: number): GeoPoint {
  if (corridor.length === 0) return { latitude: 0, longitude: 0 };
  if (corridor.length === 1) return corridor[0];

  const wrapped = ((progress % 1) + 1) % 1;
  const segments = corridor.length - 1;
  const scaled = wrapped * segments;
  const index = Math.min(Math.floor(scaled), segments - 1);
  const t = scaled - index;
  const from = corridor[index];
  const to = corridor[index + 1];

  return {
    latitude: lerp(from.latitude, to.latitude, t),
    longitude: lerp(from.longitude, to.longitude, t),
  };
}

export interface FleetUnit {
  readonly driverId: string;
  readonly corridor: keyof typeof CORRIDORS;
  /** Where on the corridor this truck starts, in [0, 1). */
  readonly offset: number;
  /** Fraction of the corridor covered per second. */
  readonly speed: number;
  /** Cosmetic body colour — status is carried separately. */
  readonly bodyColor: "yellow" | "white";
}

/** Three yellow, two white, spread across the state so none overlap at rest. */
export const FLEET: readonly FleetUnit[] = [
  { driverId: "driver-brenna", corridor: "i70", offset: 0.18, speed: 0.006, bodyColor: "yellow" },
  { driverId: "driver-alicia", corridor: "i70", offset: 0.62, speed: 0.004, bodyColor: "yellow" },
  { driverId: "driver-ray", corridor: "i25", offset: 0.78, speed: 0.005, bodyColor: "yellow" },
  { driverId: "driver-samuel", corridor: "i76", offset: 0.3, speed: 0.007, bodyColor: "white" },
  { driverId: "driver-kenji", corridor: "us50", offset: 0.45, speed: 0.0045, bodyColor: "white" },
];

/** Position of every unit `elapsedSeconds` into the simulation. */
export function fleetPositions(elapsedSeconds: number): Readonly<Record<string, GeoPoint>> {
  return Object.fromEntries(
    FLEET.map((unit) => [
      unit.driverId,
      pointAt(CORRIDORS[unit.corridor], unit.offset + unit.speed * elapsedSeconds),
    ]),
  );
}
