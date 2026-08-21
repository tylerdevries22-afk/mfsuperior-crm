import { FreightActionWorkspaceScreen, type FreightActionWorkspaceSpec } from "@/route-support/freight";

const SPEC = {
  eyebrow: "VISUAL CAPACITY PLAN",
  title: "Capacity planner",
  description: "Arrange available power, trailers, drivers, and loads while preserving assignment and timing constraints.",
  icon: "layout",
  tone: "brand",
  showArtwork: true,
  steps: [
    { id: "p-1", title: "Unassigned demand", subtitle: "3 loads · 2 dry van · 1 reefer", status: "3", tone: "warning" },
    { id: "p-2", title: "Ready capacity", subtitle: "5 drivers · 4 power units · 6 trailers", status: "15", tone: "success" },
    { id: "p-3", title: "Constraint review", subtitle: "HOS, equipment, appointment, and home-time checks", status: "required", tone: "brand" },
  ],
  actions: [
    { label: "Open dispatch schedule", icon: "calendar", route: "/(tabs)/schedule" },
    { label: "Search marketplace capacity", icon: "search", route: "/capacity-marketplace" },
    { label: "Review asset readiness", icon: "truck", route: "/capacity" },
  ],
  primaryLabel: "Review assignments",
  primaryRoute: "/(tabs)/schedule",
} satisfies FreightActionWorkspaceSpec;

export default function CapacityPlannerScreen() {
  return <FreightActionWorkspaceScreen spec={SPEC} />;
}
