import { Text, View } from "react-native";

import { ListRow, StatusBadge } from "@/components/ui";
import {
  formatCents,
  formatDuration,
  wasOnTime,
  type Trip,
} from "@/route-support/trip-history/utils";
import { useTheme } from "@/theme";

import { styles } from "../styles";

/** One delivered load, with what it earned and whether it made its window. */
export function TripRow({
  isLast,
  onPress,
  trip,
}: {
  readonly isLast: boolean;
  readonly onPress: () => void;
  readonly trip: Trip;
}) {
  const theme = useTheme();
  const onTime = wasOnTime(trip.shipment);
  return (
    <ListRow
      isLast={isLast}
      onPress={onPress}
      rich
      subtitle={`${trip.origin} → ${trip.destination}`}
      title={trip.shipment.loadNumber}
      trailing={
        <View style={styles.trailing}>
          <Text style={[styles.trailingValue, { color: theme.text }]}>
            {formatCents(trip.earningsCents)}
          </Text>
          <Text style={[styles.trailingMeta, { color: theme.textMuted }]}>
            {trip.miles.toLocaleString()} mi · {formatDuration(trip.durationMinutes)}
          </Text>
          {onTime === false ? (
            <StatusBadge showDot={false} size="sm" status="late" />
          ) : null}
        </View>
      }
    />
  );
}
