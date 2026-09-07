import type { Shipment } from "@/domain/types";

import { getHoursInTz, HOUR_HEIGHT, HOURS, scheduledEnd, scheduledStart } from "../utils";

/**
 * Ported from the Appliance Diagnostic Systems `DayTimeline` at
 * 480991b7eb0036e4e85c37d3784b2de2ca97d10d, including the overlap-splitting
 * layout and the 6am-to-10pm hour grid it positions against.
 */

export interface LayoutBlock {
  readonly shipment: Shipment;
  readonly top: number;
  readonly height: number;
  readonly left: number;
  readonly width: number;
}

export function layoutOverlappingLoads(shipments: readonly Shipment[]): LayoutBlock[] {
  if (!shipments.length) return [];
  const blocks: LayoutBlock[] = shipments.map((shipment) => {
    const startIso = scheduledStart(shipment);
    const endIso = scheduledEnd(shipment);
    const start = startIso
      ? getHoursInTz(startIso)
      : { hours: 8, minutes: 0, h12: 8, ampm: "AM" };
    const end = endIso
      ? getHoursInTz(endIso)
      : { hours: start.hours + 1, minutes: 0, h12: 9, ampm: "AM" };
    const startMinutes = start.hours * 60 + start.minutes;
    const endMinutes = end.hours * 60 + end.minutes;
    /**
     * The grid only spans 6am-10pm. Freight runs outside those hours far more
     * often than appliance service calls do, so a block is clamped to the grid
     * instead of being drawn off the top, which would carry its label out of
     * view with it.
     */
    const gridStart = HOURS[0] * 60;
    const gridEnd = (HOURS[HOURS.length - 1] + 1) * 60;
    const clampedStart = Math.min(Math.max(startMinutes, gridStart), gridEnd);
    const clampedEnd = Math.min(Math.max(endMinutes, clampedStart), gridEnd);
    const top = ((clampedStart - gridStart) / 60) * HOUR_HEIGHT;
    const height = Math.max(((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT, HOUR_HEIGHT * 0.5);
    return { shipment, top, height, left: 0, width: 1 };
  });

  const groups: number[][] = [];
  const assigned = new Set<number>();
  for (let i = 0; i < blocks.length; i += 1) {
    if (assigned.has(i)) continue;
    const group = [i];
    assigned.add(i);
    for (let j = i + 1; j < blocks.length; j += 1) {
      const a = blocks[i];
      const b = blocks[j];
      if (b.top < a.top + a.height && a.top < b.top + b.height) {
        group.push(j);
        assigned.add(j);
      }
    }
    groups.push(group);
  }

  const positioned = blocks.map((block) => ({ ...block }));
  for (const group of groups) {
    const n = group.length;
    group.forEach((idx, pos) => {
      positioned[idx].left = pos / n;
      positioned[idx].width = 1 / n;
    });
  }
  return positioned;
}
