import { FreightFormScreen, type FreightFormSpec } from "@/route-support/freight";

const SPEC = {
  eyebrow: "ACCOUNT DETAILS",
  title: "Profile details",
  description: "Update contact and notification details. Role and organization access are managed by an admin membership.",
  fields: [
    { key: "name", label: "Full name", placeholder: "Brenna Lewis" },
    { key: "phone", label: "Mobile phone", placeholder: "+1 720 555 0128" },
    { key: "email", label: "Email", placeholder: "brenna@example.com" },
    { key: "notifications", label: "Notification preference", placeholder: "Push and email" },
  ],
  submitLabel: "Save profile",
  successMessage: "Profile details saved.",
} satisfies FreightFormSpec;

export default function ProfileDetailsScreen() {
  return <FreightFormScreen spec={SPEC} />;
}
