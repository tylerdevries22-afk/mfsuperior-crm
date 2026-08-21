import { useLocalSearchParams } from "expo-router";
import { ASSET_DETAIL_SPEC } from "@/features/freight-screen-specs";
import { FreightDetailScreen } from "@/route-support/freight";

export default function CapacityAssetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <FreightDetailScreen spec={{ ...ASSET_DETAIL_SPEC, title: id?.replaceAll("-", " ") ?? ASSET_DETAIL_SPEC.title }} />;
}
