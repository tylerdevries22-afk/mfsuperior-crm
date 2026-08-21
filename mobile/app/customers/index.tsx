import { FreightCollectionScreen } from "@/route-support/freight";
import { SHIPPERS_SPEC } from "@/features/freight-screen-specs";

export default function CustomersScreen() {
  return <FreightCollectionScreen spec={SHIPPERS_SPEC} />;
}
