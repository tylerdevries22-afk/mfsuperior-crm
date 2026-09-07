import Ionicons from "@expo/vector-icons/Ionicons";
import { View } from "react-native";

import { BottomSheet, ListRow } from "@/components/ui";
import type { ExceptionCategory, ShipmentStop } from "@/domain/types";
import { formatStatus } from "@/lib/operations-format";
import { ICON, useTheme } from "@/theme";

import { styles } from "../styles";

const CATEGORIES: readonly ExceptionCategory[] = [
  "delay",
  "equipment",
  "temperature",
  "cargo_damage",
  "refused_delivery",
  "route",
  "other",
];

/** Picks the condition that best describes the issue. */
export function CategorySheet({
  onClose,
  onSelect,
  selected,
  visible,
}: {
  readonly onClose: () => void;
  readonly onSelect: (category: ExceptionCategory) => void;
  readonly selected: ExceptionCategory;
  readonly visible: boolean;
}) {
  const theme = useTheme();
  return (
    <BottomSheet onClose={onClose} title="Exception category" visible={visible}>
      <View style={styles.sheetList}>
        {CATEGORIES.map((candidate) => (
          <ListRow
            isLast={candidate === CATEGORIES.at(-1)}
            key={candidate}
            onPress={() => onSelect(candidate)}
            title={formatStatus(candidate)}
            trailing={candidate === selected ? <Ionicons color={theme.success} name="checkmark-circle" size={ICON.lg} /> : undefined}
          />
        ))}
      </View>
    </BottomSheet>
  );
}

/** Associates the report with a route stop, or with none. */
export function StopSheet({
  onClose,
  onSelect,
  selectedStopId,
  stops,
  visible,
}: {
  readonly onClose: () => void;
  readonly onSelect: (stopId: string | undefined) => void;
  readonly selectedStopId: string | undefined;
  readonly stops: readonly ShipmentStop[];
  readonly visible: boolean;
}) {
  const theme = useTheme();
  return (
    <BottomSheet onClose={onClose} title="Related stop" visible={visible}>
      <View style={styles.sheetList}>
        <ListRow isLast={stops.length === 0} onPress={() => onSelect(undefined)} title="No specific stop" />
        {stops.map((stop, index) => (
          <ListRow
            isLast={index === stops.length - 1}
            key={stop.id}
            onPress={() => onSelect(stop.id)}
            subtitle={`${stop.address.city}, ${stop.address.state}`}
            title={stop.facilityName}
            trailing={stop.id === selectedStopId ? <Ionicons color={theme.success} name="checkmark-circle" size={ICON.lg} /> : undefined}
          />
        ))}
      </View>
    </BottomSheet>
  );
}
