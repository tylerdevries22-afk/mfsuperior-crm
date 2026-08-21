import { CAPACITY_ORDERS_SPEC } from "@/features/freight-screen-specs";
import { FreightCollectionScreen } from "@/route-support/freight";

export default function CapacityBookingsScreen() {
  return <FreightCollectionScreen spec={CAPACITY_ORDERS_SPEC} />;
}
