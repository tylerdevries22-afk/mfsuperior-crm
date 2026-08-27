import { UnifiedScheduleScreen } from "@/route-support/schedule/UnifiedScheduleScreen";

/** Availability is intentionally the same calendar as Schedule, not a second source of truth. */
export default function AvailabilityScreen() {
  return <UnifiedScheduleScreen />;
}
