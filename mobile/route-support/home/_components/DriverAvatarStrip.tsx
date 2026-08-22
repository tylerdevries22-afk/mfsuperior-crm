import { ScrollView, Text, View } from "react-native";

import { DriverAvatar } from "@/components/operations";
import { AnimatedPressable } from "@/components/ui";
import type { Driver } from "@/domain/types";
import { SPACING } from "@/theme";

import { adminS, s } from "../homeStyles";

/**
 * Ported from the Appliance Diagnostic Systems `TechAvatarStrip` at
 * 480991b7eb0036e4e85c37d3784b2de2ca97d10d — same section header with its
 * trailing action, same horizontal chip rail. The reference inlines its avatar
 * with an initials fallback; MF routes it through the shared `DriverAvatar`
 * so a driver's portrait is identical everywhere it appears.
 */
export function DriverAvatarStrip({
  drivers,
  onDriverPress,
  onViewSchedule,
}: {
  readonly drivers: readonly Driver[];
  readonly onDriverPress: (driver: Driver) => void;
  readonly onViewSchedule: () => void;
}) {
  if (drivers.length === 0) return null;
  return (
    <View style={{ marginBottom: SPACING.lg }}>
      <View style={s.sectionHeaderRow}>
        <Text style={s.sectionLabel}>YOUR TEAM</Text>
        <AnimatedPressable haptic="selection" onPress={onViewSchedule}>
          <Text style={s.seeAllText}>View Schedule</Text>
        </AnimatedPressable>
      </View>
      <ScrollView
        contentContainerStyle={{ gap: SPACING.md, paddingRight: SPACING.md }}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {drivers.map((driver) => (
          <AnimatedPressable
            accessibilityLabel={`${driver.firstName} ${driver.lastName}`}
            accessibilityRole="button"
            haptic="selection"
            key={driver.id}
            onPress={() => onDriverPress(driver)}
            style={adminS.techChip}
          >
            <View style={adminS.techChipAvatar}>
              <DriverAvatar driver={driver} ring={false} size={40} />
            </View>
            <Text numberOfLines={1} style={adminS.techChipName}>
              {driver.firstName}
            </Text>
          </AnimatedPressable>
        ))}
      </ScrollView>
    </View>
  );
}
