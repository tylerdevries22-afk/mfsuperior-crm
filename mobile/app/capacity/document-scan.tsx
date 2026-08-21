import { FreightActionWorkspaceScreen, type FreightActionWorkspaceSpec } from "@/route-support/freight";

const SPEC = {
  eyebrow: "DOCUMENT CAPTURE",
  title: "Scan equipment document",
  description: "Capture registration, inspection, lease, or equipment specification pages with private upload handling.",
  icon: "file-plus",
  tone: "info",
  steps: [
    { id: "ds-1", title: "Frame the full page", subtitle: "Keep all corners visible and remove glare.", status: "ready", tone: "success" },
    { id: "ds-2", title: "Validate before upload", subtitle: "MIME, size, and image data are checked and re-encoded.", status: "automatic", tone: "brand" },
    { id: "ds-3", title: "Link to the asset", subtitle: "Choose the unit and document retention category.", status: "required", tone: "warning" },
  ],
  actions: [
    { label: "Registration", icon: "file-text" },
    { label: "Inspection report", icon: "check-square" },
    { label: "Lease or title", icon: "briefcase" },
  ],
  primaryLabel: "Open camera",
} satisfies FreightActionWorkspaceSpec;

export default function CapacityDocumentScanScreen() {
  return <FreightActionWorkspaceScreen spec={SPEC} />;
}
