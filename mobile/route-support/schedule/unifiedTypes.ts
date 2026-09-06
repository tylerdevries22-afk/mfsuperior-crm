import type {
  DriverShift
} from "@/domain/types";
import {
  blocksForDay
} from "@/route-support/availability/utils";
import { useOperations } from "@/store";

export const DAY_WIDTH = 128;

export const DRIVER_LABEL_WIDTH = 122;

export const DEFAULT_START = 8 * 60;

export const DEFAULT_END = 16 * 60;

export type CalendarMode = "admin" | "driver";

export interface UnifiedScheduleScreenProps {
  readonly mode?: CalendarMode;
}

export interface CellContent {
  readonly blocks: ReturnType<typeof blocksForDay>;
  readonly loads: ReturnType<typeof useOperations>["shipments"];
  readonly shifts: readonly DriverShift[];
}
