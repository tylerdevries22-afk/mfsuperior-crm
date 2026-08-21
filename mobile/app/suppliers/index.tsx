import { FreightCollectionScreen, type FreightCollectionSpec } from "@/route-support/freight";

const SPEC = {
  eyebrow: "PROVIDER DIRECTORY",
  title: "Suppliers",
  description: "A provider-neutral directory for equipment, maintenance, fuel, safety, and warehouse services.",
  metrics: [
    { label: "VERIFIED", value: "21", detail: "Insurance or terms", tone: "success" },
    { label: "CATEGORIES", value: "7", detail: "Regional coverage", tone: "brand" },
    { label: "REVIEW", value: "3", detail: "Renewal due", tone: "warning" },
  ],
  segments: ["All", "Equipment", "Services"],
  records: [
    { id: "s-1", title: "Front Range Trailer Services", subtitle: "Trailer rental, inspection, and mobile repair", meta: "Denver metro · Verified", status: "available", tone: "success", icon: "tool", route: "/suppliers/front-range-trailer" },
    { id: "s-2", title: "Rocky Mountain Cold Chain", subtitle: "Reefer rentals and temperature monitoring", meta: "Colorado · Onboarding review", status: "review", tone: "warning", icon: "thermometer", route: "/suppliers/rocky-mountain-cold" },
    { id: "s-3", title: "Mile High Fleet Supply", subtitle: "Safety supplies, straps, seals, and load bars", meta: "Aurora · Terms on file", status: "active", tone: "success", icon: "package", route: "/suppliers/mile-high-fleet" },
  ],
} satisfies FreightCollectionSpec;

export default function SuppliersScreen() {
  return <FreightCollectionScreen spec={SPEC} />;
}
