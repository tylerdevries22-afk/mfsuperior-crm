import { FreightFormScreen, type FreightFormSpec } from "@/route-support/freight";

const SPEC = {
  eyebrow: "EQUIPMENT REASSIGNMENT",
  title: "Transfer asset",
  description: "Move an asset between drivers, loads, or locations with explicit custody and version checks.",
  fields: [
    { key: "asset", label: "Capacity asset", placeholder: "Unit, VIN, or trailer number" },
    { key: "from", label: "Current assignment", placeholder: "Driver, load, or terminal" },
    { key: "to", label: "New assignment", placeholder: "Driver, load, or terminal" },
    { key: "note", label: "Handoff note", placeholder: "Condition, location, keys, seals, or supplies", multiline: true },
  ],
  submitLabel: "Review transfer",
  successMessage: "Transfer is staged for confirmation. Conflicting asset versions will require reconciliation.",
} satisfies FreightFormSpec;

export default function CapacityTransferScreen() {
  return <FreightFormScreen spec={SPEC} />;
}
