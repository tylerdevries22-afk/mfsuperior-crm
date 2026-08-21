import { FreightDetailScreen } from "@/route-support/freight";

export default function CapacityBookingDetailScreen() {
  return (
    <FreightDetailScreen
      spec={{
        actions: [
          { icon: "x-circle", label: "Request cancellation", route: "/capacity-marketplace/release-request" },
          { icon: "message-circle", label: "Message provider", route: "/messages" },
        ],
        eyebrow: "CAPACITY BOOKING",
        metrics: [
          { detail: "Estimated total", label: "RATE", value: "$1,440" },
          { detail: "Two-hour window", label: "PICKUP", value: "Aug 23" },
          { detail: "Swing doors", label: "EQUIPMENT", value: "53′ DV" },
          { detail: "Validated", label: "AUTHORITY", value: "Active" },
        ],
        status: "requested",
        statusTone: "warning",
        subtitle: "Denver to Cheyenne · provider-neutral dry-van capacity request.",
        timeline: [
          { id: "booking-1", meta: "Today · 10:42 AM", subtitle: "Capacity and authority checks completed.", title: "Request submitted", tone: "brand" },
          { id: "booking-2", meta: "Pending", subtitle: "The provider has not yet confirmed the booking.", title: "Confirmation required", tone: "warning" },
        ],
        title: "BK-9914",
      }}
    />
  );
}
