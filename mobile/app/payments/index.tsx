import { FreightCollectionScreen } from "@/route-support/freight";
import { SETTLEMENTS_SPEC } from "@/features/freight-screen-specs";

export default function PaymentsScreen() {
  return <FreightCollectionScreen spec={SETTLEMENTS_SPEC} />;
}
