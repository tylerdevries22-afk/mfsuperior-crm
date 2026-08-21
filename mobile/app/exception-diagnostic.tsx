import { FreightActionWorkspaceScreen, type FreightActionWorkspaceSpec } from "@/route-support/freight";

const SPEC = {
  eyebrow: "GUIDED FREIGHT TRIAGE",
  title: "Resolve the exception",
  description: "Work through shipment, EDI, tractor, trailer, and reefer evidence in a safe, auditable sequence.",
  icon: "activity",
  tone: "warning",
  showArtwork: true,
  steps: [
    { id: "s-1", title: "Identify the affected movement", subtitle: "Select the shipment, asset, or integration event.", status: "complete", tone: "success" },
    { id: "s-2", title: "Capture signals", subtitle: "Record status codes, controller readings, observations, and photos.", status: "current", tone: "brand" },
    { id: "s-3", title: "Review safe actions", subtitle: "Confirm cargo, driver, and equipment protections before resolving.", status: "next", tone: "neutral" },
  ],
  actions: [
    { label: "Shipment or EDI exception", icon: "git-pull-request", route: "/exception-signals", tone: "info" },
    { label: "Tractor or trailer fault", icon: "truck", route: "/equipment", tone: "warning" },
    { label: "Reefer temperature issue", icon: "thermometer", route: "/exception-signals", tone: "danger" },
  ],
  primaryLabel: "Continue to signals",
  primaryRoute: "/exception-signals",
} satisfies FreightActionWorkspaceSpec;

export default function ExceptionDiagnosticScreen() {
  return <FreightActionWorkspaceScreen spec={SPEC} />;
}
