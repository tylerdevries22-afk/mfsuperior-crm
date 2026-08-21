import { FreightDetailScreen, type FreightDetailSpec } from "@/route-support/freight";

const SPEC = {
  eyebrow: "TRIAGE RESULT",
  title: "Temperature-control risk",
  subtitle: "The reported probe reading and reefer controller signal indicate a likely airflow restriction or sensor mismatch.",
  status: "action required",
  statusTone: "warning",
  metrics: [
    { label: "CONFIDENCE", value: "82%", detail: "Guided assessment" },
    { label: "CARGO RISK", value: "Medium", detail: "Monitor continuously" },
    { label: "SETPOINT", value: "36°F", detail: "Continuous" },
    { label: "RETURN AIR", value: "41°F", detail: "+5°F" },
  ],
  timeline: [
    { id: "d-1", title: "Protect the shipment", subtitle: "Keep doors closed and confirm product-temperature requirements.", meta: "Do now", tone: "danger" },
    { id: "d-2", title: "Validate independent reading", subtitle: "Use a calibrated probe away from the discharge-air stream.", meta: "Next", tone: "warning" },
    { id: "d-3", title: "Escalate if variance persists", subtitle: "Notify dispatch and customer before moving or opening cargo.", meta: "Required at +5°F for 15 min", tone: "brand" },
  ],
  actions: [
    { label: "Continue guided triage", icon: "activity", route: "/exception-diagnostic" },
    { label: "Report exception", icon: "alert-triangle", route: "/exception/new" },
  ],
} satisfies FreightDetailSpec;

export default function ExceptionDiagnosisScreen() {
  return <FreightDetailScreen spec={SPEC} />;
}
