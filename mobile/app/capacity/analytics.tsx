import { FreightAnalyticsScreen, type FreightAnalyticsSpec } from "@/route-support/freight";

const SPEC = {
  eyebrow: "ASSET UTILIZATION",
  title: "Capacity analytics",
  description: "Readiness, assignment, utilization, dwell, and exception trends for MF capacity assets.",
  metrics: [
    { label: "UTILIZATION", value: "82%", detail: "+4.1%", tone: "success" },
    { label: "READY", value: "14", detail: "2 attention", tone: "brand" },
    { label: "AVG DWELL", value: "48m", detail: "−7m", tone: "success" },
    { label: "DOWNTIME", value: "3.2%", detail: "Last 30d", tone: "warning" },
  ],
  chartTitle: "Utilization by asset class",
  chart: [
    { label: "Power", value: 87, display: "87%", tone: "success" },
    { label: "Dry van", value: 82, display: "82%", tone: "brand" },
    { label: "Reefer", value: 76, display: "76%", tone: "warning" },
    { label: "Flatbed", value: 61, display: "61%", tone: "info" },
  ],
} satisfies FreightAnalyticsSpec;

export default function CapacityAnalyticsScreen() {
  return <FreightAnalyticsScreen spec={SPEC} />;
}
