import { CLAIM_FORM } from "@/features/freight-screen-specs";
import { FreightFormScreen } from "@/route-support/freight";

export default function CapacityReleaseRequestScreen() {
  return <FreightFormScreen spec={{ ...CLAIM_FORM, eyebrow: "BOOKING RELEASE", title: "Release or claim", description: "Request a booking cancellation or open a claim with a complete, reviewable record.", submitLabel: "Save release request" }} />;
}
