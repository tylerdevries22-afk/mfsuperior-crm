import { driverShiftConflict } from "@/domain/scheduling";
import type {
  AvailabilityBlockInput,
  AvailabilityRuleInput,
  Driver,
  DriverShift
} from "@/domain/types";
import {
  blocksForDay,
  loadTouchesDay
} from "@/route-support/availability/utils";
import {
  formatDateKey,
  scheduledStart
} from "@/route-support/schedule/utils";
import { useOperations } from "@/store";
import { useTheme } from "@/theme";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { addDays, shiftTouchesDay, startOfWeek } from './unifiedHelpers';
import { CalendarMode, CellContent } from './unifiedTypes';

export function useUnifiedSchedule(mode?: CalendarMode) {
  const router = useRouter();
  const theme = useTheme();
  const operations = useOperations();
  const {
    actions,
    availabilityBlocks,
    availabilityRules,
    currentDriver,
    driverShifts,
    effectiveRole,
    isHydrated,
    scheduleSyncStatuses,
    shipments,
    shiftCoverageRequests,
    state,
  } = operations;
  const drivers = state.drivers;
  const isAdmin = mode === "admin" || effectiveRole === "admin";
  const currentMode: CalendarMode = isAdmin ? "admin" : "driver";
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(new Date()));
  const [selectedDateKey, setSelectedDateKey] = useState(() => formatDateKey(new Date()));
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [blockDriverId, setBlockDriverId] = useState<string | null>(null);
  const [shiftEditor, setShiftEditor] = useState<{
    readonly dateKey: string;
    readonly shift?: DriverShift;
    readonly driverId?: string;
  } | null>(null);
  const [detailShift, setDetailShift] = useState<DriverShift | null>(null);
  const [coverageShift, setCoverageShift] = useState<DriverShift | null>(null);
  const [blockDateKey, setBlockDateKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekAnchor, index)),
    [weekAnchor],
  );
  const visibleDrivers = useMemo(() => {
    if (currentMode === "driver") return currentDriver ? [currentDriver] : [];
    if (!selectedDriverId) return drivers;
    return drivers.filter((driver) => driver.id === selectedDriverId);
  }, [currentDriver, currentMode, drivers, selectedDriverId]);
  const boardDrivers = currentMode === "driver" && currentDriver ? [currentDriver] : visibleDrivers;
  const selectedBlockDriver = currentMode === "driver"
    ? currentDriver
    : drivers.find((driver) => driver.id === (blockDriverId ?? selectedDriverId)) ?? drivers[0];
  const pendingSyncCount = scheduleSyncStatuses.filter((sync) => sync.status === "pending").length;
  const conflictCount = driverShifts.filter((shift) => driverShiftConflict(state, shift) !== null).length;
  const gapCount = shipments.filter((shipment) => (
    shipment.status !== "delivered" &&
    shipment.status !== "cancelled" &&
    (!shipment.assignedDriverId || !driverShifts.some((shift) => (
      shift.driverId === shipment.assignedDriverId &&
      scheduledStart(shipment) !== null &&
      loadTouchesDay(shipment, formatDateKey(new Date(shift.startsAt)))
    )))
  )).length;
  if (!isAdmin && currentDriver && !selectedDriverId) setSelectedDriverId(currentDriver.id);
  const runAction = async (action: () => Promise<boolean>) => {
    setBusy(true);
    try {
      return await action();
    } finally {
      setBusy(false);
    }
  };
  const changeWeek = (delta: number) => {
    const next = addDays(weekAnchor, delta * 7);
    setWeekAnchor(next);
    setSelectedDateKey(formatDateKey(next));
  };
  const cellContent = (driverId: string, dateKey: string): CellContent => ({
    blocks: blocksForDay(
      availabilityBlocks.filter((block) => block.driverId === driverId),
      availabilityRules.filter((rule) => rule.driverId === driverId),
      dateKey,
    ),
    loads: shipments.filter((shipment) => (
      shipment.assignedDriverId === driverId && loadTouchesDay(shipment, dateKey)
    )),
    shifts: driverShifts.filter((shift) => shift.driverId === driverId && shiftTouchesDay(shift, dateKey)),
  });
  const openCell = (driver: Driver, dateKey: string) => {
    if (currentMode === "admin") {
      setShiftEditor({ dateKey, driverId: driver.id });
      return;
    }
    setBlockDriverId(driver.id);
    setBlockDateKey(dateKey);
  };
  const handleBlockSave = async (input: AvailabilityBlockInput) => {
    if (await runAction(() => actions.setAvailabilityBlock({ ...input, driverId: selectedBlockDriver?.id }))) setBlockDateKey(null);
  };
  const handleRuleSave = async (input: AvailabilityRuleInput) => {
    if (await runAction(() => actions.setAvailabilityRule({ ...input, driverId: selectedBlockDriver?.id }))) setBlockDateKey(null);
  };
  const handleDeleteBlock = async (blockId: string) => {
    await runAction(() => actions.removeAvailabilityBlock(blockId));
  };
  const openLoad = (shipmentId: string) => router.push({ pathname: "/load/[id]", params: { id: shipmentId } });
  return { theme, actions, availabilityBlocks, availabilityRules, currentDriver, driverShifts, isHydrated, scheduleSyncStatuses, shipments, shiftCoverageRequests, state, drivers, isAdmin, currentMode, setWeekAnchor, selectedDateKey, setSelectedDateKey, selectedDriverId, setSelectedDriverId, setBlockDriverId, shiftEditor, setShiftEditor, detailShift, setDetailShift, coverageShift, setCoverageShift, blockDateKey, setBlockDateKey, busy, weekDates, boardDrivers, selectedBlockDriver, pendingSyncCount, conflictCount, gapCount, runAction, changeWeek, cellContent, openCell, handleBlockSave, handleRuleSave, handleDeleteBlock, openLoad };
}
