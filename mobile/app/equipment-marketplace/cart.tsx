import { FreightCartScreen, type FreightCartSpec } from "@/route-support/freight";

const SPEC = {
  eyebrow: "EQUIPMENT REQUEST",
  title: "Request cart",
  description: "Review equipment terms and availability before sending an internal approval request.",
  items: [
    { id: "eq-1", title: "2025 53′ dry van", subtitle: "12-month lease · Denver pickup", meta: "$1,280/month", icon: "box" },
    { id: "eq-2", title: "Reefer telemetry kit", subtitle: "Remote probe and door sensor", meta: "$89/month", icon: "wifi" },
  ],
  totalLabel: "MONTHLY ESTIMATE",
  total: "$1,369",
  submitLabel: "Request admin approval",
} satisfies FreightCartSpec;

export default function EquipmentRequestCartScreen() {
  return <FreightCartScreen spec={SPEC} />;
}
