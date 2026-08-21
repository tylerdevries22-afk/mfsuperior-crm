import { FreightActionWorkspaceScreen, type FreightActionWorkspaceSpec } from "@/route-support/freight";

const SPEC = {
  eyebrow: "OBSERVED SIGNALS",
  title: "What changed?",
  description: "Choose every relevant signal. The triage result keeps operational and equipment causes separate.",
  icon: "radio",
  tone: "info",
  steps: [
    { id: "sg-1", title: "Shipment signals", subtitle: "Late appointment, missing status, seal, cargo, or POD.", status: "select", tone: "brand" },
    { id: "sg-2", title: "Vehicle signals", subtitle: "Dash warning, air pressure, electrical, or drivability.", status: "select", tone: "warning" },
    { id: "sg-3", title: "Reefer signals", subtitle: "Setpoint variance, controller alarm, airflow, fuel, or door.", status: "select", tone: "danger" },
  ],
  actions: [
    { label: "Late or missed appointment", icon: "clock", tone: "warning" },
    { label: "EDI status rejected", icon: "git-merge", tone: "info" },
    { label: "Temperature outside range", icon: "thermometer", tone: "danger" },
  ],
  primaryLabel: "Generate triage result",
  primaryRoute: "/exception-diagnosis",
} satisfies FreightActionWorkspaceSpec;

export default function ExceptionSignalsScreen() {
  return <FreightActionWorkspaceScreen spec={SPEC} />;
}
