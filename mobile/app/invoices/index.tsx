import { FreightCollectionScreen } from "@/route-support/freight";
import { INVOICES_SPEC } from "@/features/freight-screen-specs";

export default function InvoicesScreen() {
  return <FreightCollectionScreen spec={INVOICES_SPEC} />;
}
