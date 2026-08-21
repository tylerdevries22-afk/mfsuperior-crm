import { useLocalSearchParams } from "expo-router";
import { SHIPPER_DETAIL_SPEC } from "@/features/freight-screen-specs";
import { FreightDetailScreen } from "@/route-support/freight";

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <FreightDetailScreen spec={id === "front-range-grocery" ? SHIPPER_DETAIL_SPEC : { ...SHIPPER_DETAIL_SPEC, title: id?.replaceAll("-", " ") ?? SHIPPER_DETAIL_SPEC.title }} />;
}
