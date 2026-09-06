import { useEffect, useMemo, useState } from "react";
import { useOperations } from "@/store";
import { selectOperationBadges } from "./operationBadges";

/** Repository subscriptions drive changes; the clock also refreshes expiry-based counts. */
export function useOperationBadges() {
  const { state, vehicles, shipments, maintenanceOrders, complianceDocuments } = useOperations();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return useMemo(() => selectOperationBadges({ vehicles, drivers: state.drivers, shipments, maintenanceOrders, complianceDocuments }, now), [vehicles, state.drivers, shipments, maintenanceOrders, complianceDocuments, now]);
}
