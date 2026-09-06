import { DriverAvatar } from "@/components/operations/DriverAvatar";
import type {
  Driver,
  DriverShift
} from "@/domain/types";
import {
  formatMinuteRange,
  isoToMinutes
} from "@/route-support/availability/utils";
import {
  driverFullName,
  formatDateKey,
  formatTime
} from "@/route-support/schedule/utils";
import { useTheme } from "@/theme";
import { Feather } from "@expo/vector-icons";
import {
  Pressable,
  Text,
  View
} from "react-native";
import { styles } from './unifiedStyles';
import { CellContent } from './unifiedTypes';

export function DriverRow({
  contentForCell,
  dateKeys,
  driver,
  onBlockPress,
  onCellPress,
  onLoadPress,
  onShiftPress,
  theme,
}: {
  readonly contentForCell: (driverId: string, dateKey: string) => CellContent;
  readonly dateKeys: readonly string[];
  readonly driver: Driver;
  readonly onBlockPress: (dateKey: string) => void;
  readonly onCellPress: (dateKey: string) => void;
  readonly onLoadPress: (shipmentId: string) => void;
  readonly onShiftPress: (shift: DriverShift) => void;
  readonly theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={[styles.driverRow, { borderTopColor: theme.border }]}>
      <View style={[styles.driverLabel, styles.driverLabelBody, { borderRightColor: theme.border }]}>
        <DriverAvatar driver={driver} ring={false} size={28} />
        <View style={styles.driverLabelCopy}><Text numberOfLines={1} style={[styles.driverName, { color: theme.text }]}>{driver.firstName} {driver.lastName[0]}.</Text><Text style={[styles.driverStatus, { color: driver.status === "suspended" ? theme.danger : theme.textMuted }]}>{driver.status.replace("_", " ")}</Text></View>
      </View>
      {dateKeys.map((dateKey) => {
        const content = contentForCell(driver.id, dateKey);
        const hasEvents = content.shifts.length > 0 || content.loads.length > 0 || content.blocks.length > 0;
        return (
          <Pressable
            accessibilityLabel={`${driverFullName(driver)} ${dateKey}${hasEvents ? " schedule" : " empty schedule slot"}`}
            role={hasEvents ? "group" : "button"}
            key={`${driver.id}-${dateKey}`}
            delayLongPress={220}
            onLongPress={hasEvents ? undefined : () => onCellPress(dateKey)}
            onPress={hasEvents ? undefined : () => onCellPress(dateKey)}
            style={[styles.dayCell, { borderRightColor: theme.border }, !hasEvents && styles.emptyCell]}
          >
            {content.shifts.map((shift) => <EventChip key={shift.id} label={`${formatTime(shift.startsAt)} shift`} onPress={() => onShiftPress(shift)} tone="shift" theme={theme} />)}
            {content.loads.slice(0, 2).map((load) => <EventChip key={load.id} label={`${load.loadNumber} load`} onPress={() => onLoadPress(load.id)} tone="load" theme={theme} />)}
            {content.blocks.filter((block) => block.kind === "unavailable" || block.kind === "time_off").slice(0, 2).map((block) => <EventChip key={block.id} label={`${formatMinuteRange(isoToMinutes(block.startsAt, dateKey), isoToMinutes(block.endsAt, dateKey))} blocked`} onPress={() => onBlockPress(dateKey)} tone="blocked" theme={theme} />)}
            {content.loads.length > 2 ? <Text style={[styles.moreEvents, { color: theme.textMuted }]}>+{content.loads.length - 2} more loads</Text> : null}
            {!hasEvents ? <Feather color={theme.borderLight} name="plus" size={16} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function EventChip({ label, onPress, tone, theme }: { readonly label: string; readonly onPress: () => void; readonly tone: "shift" | "load" | "blocked"; readonly theme: ReturnType<typeof useTheme> }) {
  const toneColor = tone === "shift" ? theme.primary : tone === "load" ? "#7DD3FC" : theme.danger;
  return <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={[styles.eventChip, { backgroundColor: `${toneColor}22`, borderColor: `${toneColor}70` }]}><View style={[styles.eventDot, { backgroundColor: toneColor }]} /><Text numberOfLines={1} style={[styles.eventText, { color: theme.text }]}>{label}</Text></Pressable>;
}

export function DayHeader({ date, onPress, selected, theme }: { readonly date: Date; readonly onPress: () => void; readonly selected: boolean; readonly theme: ReturnType<typeof useTheme> }) {
  const key = formatDateKey(date);
  return <Pressable accessibilityLabel={key} accessibilityRole="button" onPress={onPress} style={[styles.dayHeader, { borderRightColor: theme.border }, selected && { backgroundColor: theme.tint.primary.medium }]}><Text style={[styles.dayHeaderLabel, { color: selected ? theme.primaryLight : theme.textMuted }]}>{date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}</Text><Text style={[styles.dayHeaderNumber, { color: selected ? theme.text : theme.textSecondary }]}>{date.getDate()}</Text></Pressable>;
}

export function Metric({ label, tone, value }: { readonly label: string; readonly tone: string; readonly value: string }) {
  const theme = useTheme();
  return <View style={styles.metric}><Text style={[styles.metricValue, { color: tone }]}>{value}</Text><Text style={[styles.metricLabel, { color: theme.textSecondary }]}>{label}</Text></View>;
}

export function LegendDot({ color, label, theme }: { readonly color: string; readonly label: string; readonly theme: ReturnType<typeof useTheme> }) {
  return <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={[styles.legendText, { color: theme.textSecondary }]}>{label}</Text></View>;
}
