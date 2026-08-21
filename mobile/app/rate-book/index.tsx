import { FreightCollectionScreen } from "@/route-support/freight";
import { RATES_SPEC } from "@/features/freight-screen-specs";

export default function RateBookScreen() {
  return <FreightCollectionScreen spec={RATES_SPEC} />;
}
