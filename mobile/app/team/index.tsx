import { FreightCollectionScreen } from "@/route-support/freight";
import { DRIVERS_SPEC } from "@/features/freight-screen-specs";

export default function TeamScreen() {
  return <FreightCollectionScreen spec={DRIVERS_SPEC} />;
}
