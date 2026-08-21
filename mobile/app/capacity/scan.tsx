import { FreightActionWorkspaceScreen, type FreightActionWorkspaceSpec } from "@/route-support/freight";

const SPEC = {
  eyebrow: "VIN & UNIT SCAN",
  title: "Scan capacity asset",
  description: "Scan a VIN, unit barcode, QR code, or trailer identifier to find the exact capacity record.",
  icon: "maximize",
  tone: "brand",
  steps: [
    { id: "sc-1", title: "Position the identifier", subtitle: "Fill the guide without cutting off characters.", status: "ready", tone: "success" },
    { id: "sc-2", title: "Validate the match", subtitle: "Confirm unit type and organization ownership.", status: "automatic", tone: "brand" },
    { id: "sc-3", title: "Open the asset", subtitle: "Review assignment, readiness, and recent events.", status: "next", tone: "neutral" },
  ],
  actions: [
    { label: "Enter VIN manually", icon: "edit-3" },
    { label: "Search capacity registry", icon: "search", route: "/capacity/search" },
  ],
  primaryLabel: "Start scanner",
} satisfies FreightActionWorkspaceSpec;

export default function CapacityScanScreen() {
  return <FreightActionWorkspaceScreen spec={SPEC} />;
}
