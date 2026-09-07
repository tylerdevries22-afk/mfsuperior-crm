import Feather from "@expo/vector-icons/Feather";
import { View } from "react-native";

import { Badge, ListRow, StatusBadge } from "@/components/ui";
import {
  MAINTENANCE_SEVERITY_LABELS,
  MAINTENANCE_STATUS_LABELS,
  severityTone,
  type MaintenanceEntry,
} from "@/route-support/maintenance/utils";
import { ICON, useTheme } from "@/theme";

import { styles } from "../styles";

/** One work order on the shop board. */
export function OrderRow({
  entry,
  isLast,
  onPress,
}: {
  readonly entry: MaintenanceEntry;
  readonly isLast: boolean;
  readonly onPress: () => void;
}) {
  const theme = useTheme();
  const { order, vehicle } = entry;
  return (
    <ListRow
      isLast={isLast}
      leading={
        <View style={[styles.kindWell, { backgroundColor: theme.surfaceElevated }]}>
          <Feather
            color={theme.primaryLight}
            name={order.kind === "inspection" ? "check-square" : order.kind === "preventive" ? "calendar" : "tool"}
            size={ICON.md}
          />
        </View>
      }
      onPress={onPress}
      rich
      subtitle={`${vehicle ? `Unit ${vehicle.unitNumber}` : "Unknown unit"} · opened ${new Date(order.openedAt).toLocaleDateString()}`}
      title={order.summary}
      trailing={
        <View style={styles.trailing}>
          <StatusBadge size="sm" status={MAINTENANCE_STATUS_LABELS[order.status]} />
          <Badge
            label={MAINTENANCE_SEVERITY_LABELS[order.severity]}
            showDot={false}
            size="sm"
            tone={severityTone(order.severity)}
          />
        </View>
      }
    />
  );
}
