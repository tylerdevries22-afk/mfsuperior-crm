import { MINUTES_PER_DAY, formatMinute } from "@/route-support/availability/utils";
import {
  Animated,
  Text,
  View
} from "react-native";
import { HANDLE_SIZE, HOUR_TICKS, TimeRangeTrackProps, styles } from "./timeRangeParts";
import { useTimeRangeTrack } from "./useTimeRangeTrack";

export function TimeRangeTrack({
  accessibilityLabel = "Time range",
  disabled = false,
  endMinute,
  onChange,
  onSettle,
  startMinute,
}: TimeRangeTrackProps) {
  const { theme, grip, responder, onLayout, geometry, scale } = useTimeRangeTrack({ accessibilityLabel, disabled, endMinute, onChange, onSettle, startMinute });
  return (
    <View style={styles.wrapper}>
      <View style={styles.readoutRow}>
        <Text style={[styles.readout, { color: theme.text }]}>{formatMinute(startMinute)}</Text>
        <Text style={[styles.readoutDivider, { color: theme.textMuted }]}>to</Text>
        <Text style={[styles.readout, { color: theme.text }]}>{formatMinute(endMinute)}</Text>
      </View>

      <View
        accessibilityHint="Drag either end to change the time, or drag the middle to move the whole span."
        accessibilityLabel={`${accessibilityLabel}, ${formatMinute(startMinute)} to ${formatMinute(endMinute)}`}
        accessibilityRole="adjustable"
        accessibilityState={{ disabled }}
        accessibilityValue={{ max: MINUTES_PER_DAY, min: 0, now: startMinute }}
        onLayout={onLayout}
        style={[
          styles.track,
          { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
          disabled && styles.trackDisabled,
        ]}
        {...responder.panHandlers}
      >
        {HOUR_TICKS.map((hour) => (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no"
            key={hour}
            style={[
              styles.tick,
              { backgroundColor: theme.border, left: `${(hour / 24) * 100}%` },
            ]}
          />
        ))}

        <Animated.View
          style={[
            styles.span,
            {
              backgroundColor: disabled ? theme.tint.primary.soft : theme.tint.primary.medium,
              borderColor: theme.primaryLight,
              left: geometry.left,
              transform: [{ scaleY: scale }],
              width: geometry.width,
            },
          ]}
        />

        <Animated.View
          style={[
            styles.handle,
            {
              backgroundColor: theme.primaryLight,
              left: geometry.left - HANDLE_SIZE / 2,
              transform: [{ scale: grip === "start" ? scale : 1 }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.handle,
            {
              backgroundColor: theme.primaryLight,
              left: geometry.left + geometry.width - HANDLE_SIZE / 2,
              transform: [{ scale: grip === "end" ? scale : 1 }],
            },
          ]}
        />
      </View>

      <View style={styles.scaleRow}>
        {HOUR_TICKS.map((hour) => (
          <Text key={hour} style={[styles.scaleLabel, { color: theme.textMuted }]}>
            {hour === 24 ? "12a" : hour === 0 ? "12a" : hour === 12 ? "12p" : hour > 12 ? `${hour - 12}p` : `${hour}a`}
          </Text>
        ))}
      </View>
    </View>
  );
}
