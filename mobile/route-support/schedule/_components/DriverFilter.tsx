import { Feather } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { DriverAvatar, driverColor } from "@/components/operations";
import type { Driver } from "@/domain/types";
import { FONTS, RADIUS_LEGACY as RADIUS, THEME } from "@/theme";


/**
 * Ported from the Appliance Diagnostic Systems `TechnicianFilter` at
 * 480991b7eb0036e4e85c37d3784b2de2ca97d10d — same chip row, same "All" chip,
 * same avatar-in-chip treatment and comparison cap.
 */

const MAX_COMPARE = 3;

interface DriverFilterProps {
  readonly drivers: readonly Driver[];
  readonly selected: readonly string[];
  readonly onToggle: (id: string) => void;
}

export function DriverFilter({ drivers, selected, onToggle }: DriverFilterProps) {
  if (!drivers.length) return null;
  const noneSelected = selected.length === 0;

  return (
    <ScrollView
      contentContainerStyle={df.container}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      <Pressable
        accessibilityLabel="Show all drivers"
        accessibilityRole="button"
        onPress={() => onToggle("")}
        style={[df.chip, noneSelected && df.chipActive]}
      >
        <Feather color={noneSelected ? "#fff" : THEME.textMuted} name="users" size={12} />
        <Text style={[df.chipText, noneSelected && df.chipTextActive]}>All</Text>
      </Pressable>
      {drivers.map((driver) => {
        const active = selected.includes(driver.id);
        const atLimit = !active && selected.length >= MAX_COMPARE;
        const color = driverColor(driver);
        return (
          <Pressable
            accessibilityLabel={`Filter by ${driver.firstName}`}
            accessibilityRole="button"
            key={driver.id}
            onPress={() => {
              if (!atLimit) onToggle(driver.id);
            }}
            style={[
              df.chip,
              active && { backgroundColor: `${color}30`, borderColor: color },
              atLimit && { opacity: 0.4 },
            ]}
          >
            <DriverAvatar driver={driver} size={18} />
            <Text
              numberOfLines={1}
              style={[df.chipText, active && { color: "#fff", fontFamily: FONTS.semibold }]}
            >
              {driver.firstName}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const df = StyleSheet.create({
  chip: {
    alignItems: "center",
    backgroundColor: THEME.surfaceElevated,
    borderColor: THEME.border,
    borderRadius: RADIUS.full,
    borderWidth: 2,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: THEME.primary, borderColor: THEME.primary },
  chipText: {
    color: THEME.textSecondary,
    fontFamily: FONTS.medium,
    fontSize: 12,
    maxWidth: 70,
  },
  chipTextActive: { color: "#fff", fontFamily: FONTS.semibold },
  container: { gap: 6, paddingVertical: 2 },
});
