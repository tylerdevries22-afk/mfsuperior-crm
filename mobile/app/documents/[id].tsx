import { useLocalSearchParams } from "expo-router";

import { FreightDetailScreen } from "@/route-support/freight";

export default function FreightDocumentGuideScreen() {
  const { id = "document" } = useLocalSearchParams<{ id: string }>();
  const title = id === "pod-checklist" ? "Proof of delivery checklist" : id.replaceAll("-", " ");

  return (
    <FreightDetailScreen
      spec={{
        actions: [
          { icon: "camera", label: "Capture document", route: "/freight-document-viewer" },
          { icon: "message-circle", label: "Ask operations", route: "/messages" },
        ],
        eyebrow: "SERVICE DOCUMENT",
        metrics: [
          { detail: "Signature and printed name", label: "REQUIRED", value: "4 fields" },
          { detail: "Private storage", label: "UPLOAD", value: "20 MB max" },
          { detail: "Server-issued URL", label: "ACCESS", value: "Signed" },
          { detail: "Before submission", label: "QUALITY", value: "Verified" },
        ],
        status: "current",
        statusTone: "success",
        subtitle: "Required fields, image-quality checks, secure upload, and delivery verification.",
        timeline: [
          { id: "document-1", meta: "Step 1", subtitle: "Confirm shipment, consignee, and delivery timestamp.", title: "Verify delivery context", tone: "brand" },
          { id: "document-2", meta: "Step 2", subtitle: "Capture the signed page with every corner legible.", title: "Capture proof", tone: "neutral" },
          { id: "document-3", meta: "Step 3", subtitle: "Review the re-encoded image before final submission.", title: "Submit securely", tone: "success" },
        ],
        title,
      }}
    />
  );
}
