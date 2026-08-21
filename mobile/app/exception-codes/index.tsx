import { FreightCollectionScreen } from "@/route-support/freight";
import { EDI_CODES_SPEC } from "@/features/freight-screen-specs";

export default function ExceptionCodesScreen() {
  return <FreightCollectionScreen spec={EDI_CODES_SPEC} />;
}
