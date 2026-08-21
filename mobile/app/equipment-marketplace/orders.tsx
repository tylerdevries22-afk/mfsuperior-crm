import { EQUIPMENT_ORDERS_SPEC } from "@/features/freight-screen-specs";
import { FreightCollectionScreen } from "@/route-support/freight";

export default function EquipmentOrdersScreen() {
  return <FreightCollectionScreen spec={EQUIPMENT_ORDERS_SPEC} />;
}
