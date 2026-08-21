import { useLocalSearchParams } from "expo-router";
import { createFreightDetailSpec } from "@/features/freight-detail-specs";
import { FreightDetailScreen } from "@/route-support/freight";

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <FreightDetailScreen spec={createFreightDetailSpec("invoice", id)} />;
}
