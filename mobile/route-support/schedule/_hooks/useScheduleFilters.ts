import { useCallback, useEffect, useState } from "react";

/**
 * Ported from the Appliance Diagnostic Systems `useScheduleFilters` at
 * 480991b7eb0036e4e85c37d3784b2de2ca97d10d. An empty selection means "all",
 * which is what lets the "All" chip and "Select all" row share one state.
 */
export function useScheduleFilters(driverIdParam?: string) {
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>(() =>
    driverIdParam ? [driverIdParam] : [],
  );

  useEffect(() => {
    setSelectedDriverIds(driverIdParam ? [driverIdParam] : []);
  }, [driverIdParam]);

  const toggleDriver = useCallback((driverId: string) => {
    if (!driverId) {
      setSelectedDriverIds([]);
      return;
    }
    setSelectedDriverIds((prev) =>
      prev.includes(driverId) ? prev.filter((id) => id !== driverId) : [...prev, driverId],
    );
  }, []);

  const toggleSelectAll = useCallback(
    (allDriverIds: readonly string[]) => {
      setSelectedDriverIds((prev) => (prev.length === allDriverIds.length ? [] : [...allDriverIds]));
    },
    [],
  );

  return { selectedDriverIds, setSelectedDriverIds, toggleDriver, toggleSelectAll };
}
