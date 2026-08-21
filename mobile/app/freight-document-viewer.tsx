import { FreightActionWorkspaceScreen, type FreightActionWorkspaceSpec } from "@/route-support/freight";

const SPEC = {
  eyebrow: "FREIGHT DOCUMENT",
  title: "Load and equipment documents",
  description: "Review BOL, POD, inspection, registration, lease, and technical documents in a private viewer.",
  icon: "file-text",
  tone: "info",
  steps: [
    { id: "doc-1", title: "Bill of lading", subtitle: "Shipment MF-2048 · 3 pages", status: "verified", tone: "success" },
    { id: "doc-2", title: "Trailer inspection", subtitle: "Trailer R-218 · Aug 21", status: "current", tone: "success" },
    { id: "doc-3", title: "Reefer operating guide", subtitle: "Carrier X4 controller · 14 pages", status: "reference", tone: "info" },
  ],
  actions: [
    { label: "Open bill of lading", icon: "file" },
    { label: "Open inspection report", icon: "check-square" },
    { label: "Open equipment guide", icon: "book-open" },
  ],
  primaryLabel: "Download signed copy",
} satisfies FreightActionWorkspaceSpec;

export default function FreightDocumentViewerScreen() {
  return <FreightActionWorkspaceScreen spec={SPEC} />;
}
