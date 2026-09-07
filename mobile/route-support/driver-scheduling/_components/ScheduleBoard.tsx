import Feather from "@expo/vector-icons/Feather";
import { Text, View } from "react-native";

import { DriverAvatar } from "@/components/operations";
import { AnimatedPressable, Card } from "@/components/ui";
import {
  dayNumber,
  shortDayLabel,
  type DriverWeek,
  type ScheduleCell,
} from "@/route-support/driver-scheduling/utils";
import { driverFullName } from "@/route-support/schedule/utils";
import { useTheme } from "@/theme";

import { styles } from "../styles";

/** The week grid: a day header strip over one row per driver. */
export function ScheduleBoard({
  dayKeys,
  onOpenCell,
  weeks,
}: {
  readonly dayKeys: readonly string[];
  readonly onOpenCell: (driverId: string, dateKey: string) => void;
  readonly weeks: readonly DriverWeek[];
}) {
  const theme = useTheme();
  return (
    <Card padding="none">
      <View style={[styles.dayHeaderRow, { borderBottomColor: theme.border }]}>
        <View style={styles.driverColumn} />
        {dayKeys.map((dateKey) => (
          <View key={dateKey} style={styles.dayHeader}>
            <Text style={[styles.dayHeaderLabel, { color: theme.textMuted }]}>
              {shortDayLabel(dateKey)}
            </Text>
            <Text style={[styles.dayHeaderNumber, { color: theme.textSecondary }]}>
              {dayNumber(dateKey)}
            </Text>
          </View>
        ))}
      </View>

      {weeks.map((week, index) => (
        <DriverRow
          isLast={index === weeks.length - 1}
          key={week.driver.id}
          onOpenCell={(dateKey) => onOpenCell(week.driver.id, dateKey)}
          week={week}
        />
      ))}
    </Card>
  );
}

function DriverRow({
  isLast,
  onOpenCell,
  week,
}: {
  readonly isLast: boolean;
  readonly onOpenCell: (dateKey: string) => void;
  readonly week: DriverWeek;
}) {
  const theme = useTheme();
  return (
    <View
      style={[styles.driverRow, !isLast && { borderBottomColor: theme.border, borderBottomWidth: 1 }]}
    >
      <View style={styles.driverColumn}>
        <DriverAvatar driver={week.driver} ring={false} size={28} />
        <Text numberOfLines={1} style={[styles.driverName, { color: theme.text }]}>
          {week.driver.firstName}
        </Text>
      </View>
      {week.cells.map((cell) => (
        <Cell
          cell={cell}
          driverName={driverFullName(week.driver)}
          key={cell.dateKey}
          onPress={() => onOpenCell(cell.dateKey)}
        />
      ))}
    </View>
  );
}

function Cell({
  cell,
  driverName,
  onPress,
}: {
  readonly cell: ScheduleCell;
  readonly driverName: string;
  readonly onPress: () => void;
}) {
  const theme = useTheme();
  const { conflicted, loads, summary } = cell;

  const background = conflicted
    ? theme.dangerMuted
    : loads.length > 0
      ? theme.tint.primary.medium
      : summary.coverage === "off"
        ? theme.surfaceElevated
        : summary.coverage === "partial"
          ? theme.warningMuted
          : "transparent";

  const label = conflicted
    ? "carrying a load through blocked time"
    : loads.length > 0
      ? `${loads.length} load${loads.length === 1 ? "" : "s"}`
      : summary.coverage === "off"
        ? "unavailable"
        : summary.coverage === "partial" ? "partly blocked" : "open";

  return (
    <AnimatedPressable
      accessibilityLabel={`${driverName}, ${cell.dateKey}, ${label}`}
      haptic="selection"
      onPress={onPress}
      style={[styles.cell, { backgroundColor: background }]}
    >
      {conflicted ? (
        <Feather color={theme.danger} name="alert-triangle" size={12} />
      ) : loads.length > 0 ? (
        <Text style={[styles.cellCount, { color: theme.text }]}>{loads.length}</Text>
      ) : summary.coverage === "off" ? (
        <View style={[styles.offBar, { backgroundColor: theme.textMuted }]} />
      ) : null}
    </AnimatedPressable>
  );
}
