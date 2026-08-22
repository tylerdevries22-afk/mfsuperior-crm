import { AdminHome } from "@/route-support/home/AdminHome";
import { CustomerHome } from "@/route-support/home/CustomerHome";
import { DriverHome } from "@/route-support/home/DriverHome";
import { useOperations } from "@/store";

/**
 * Mirrors the Appliance Diagnostic Systems home entry at
 * 480991b7eb0036e4e85c37d3784b2de2ca97d10d, which is a thin role switch over
 * three separate home compositions rather than one screen with branches.
 */
export default function HomeScreen() {
  const { effectiveRole } = useOperations();
  if (effectiveRole === "customer") return <CustomerHome />;
  if (effectiveRole === "admin") return <AdminHome />;
  return <DriverHome />;
}
