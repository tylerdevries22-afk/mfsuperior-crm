import { FreightCollectionScreen } from "@/route-support/freight";
import { LOADS_SPEC } from "@/features/freight-screen-specs";

export default function LoadsScreen() {
  return <FreightCollectionScreen spec={LOADS_SPEC} />;
}
