import { FreightDetailScreen } from "@/route-support/freight";

export default function EquipmentOrderDetailScreen() {
  return (
    <FreightDetailScreen
      spec={{
        actions: [
          { icon: "corner-up-left", label: "Start return", route: "/equipment-marketplace/return-request" },
          { icon: "message-circle", label: "Contact supplier", route: "/messages" },
        ],
        eyebrow: "EQUIPMENT ORDER",
        metrics: [
          { detail: "12-month term", label: "LEASE", value: "$1,280/mo" },
          { detail: "Refundable", label: "DEPOSIT", value: "$1,000" },
          { detail: "Denver yard", label: "PICKUP", value: "Aug 26" },
          { detail: "Required before release", label: "DOCUMENTS", value: "2 open" },
        ],
        status: "review",
        statusTone: "warning",
        subtitle: "2025 53′ dry-van lease request with provider-neutral fulfillment.",
        timeline: [
          { id: "order-1", meta: "Today · 9:18 AM", subtitle: "Terms and unit availability were recorded.", title: "Order received", tone: "brand" },
          { id: "order-2", meta: "Pending", subtitle: "Insurance certificate and lease signature are still required.", title: "Documents under review", tone: "warning" },
        ],
        title: "EQ-408",
      }}
    />
  );
}
