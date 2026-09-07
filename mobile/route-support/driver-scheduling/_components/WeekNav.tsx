import Feather from "@expo/vector-icons/Feather";
import { Text, View } from "react-native";

import { AnimatedPressable, Card, IconButton } from "@/components/ui";
import { weekRangeLabel } from "@/route-support/driver-scheduling/utils";
import { ICON, useTheme } from "@/theme";

import { styles } from "../styles";

/** Week stepper plus the conflict banner that sits above the board. */
export function WeekNav({
  conflicts,
  dayKeys,
  onNext,
  onPrevious,
  onThisWeek,
  showThisWeek,
}: {
  readonly conflicts: number;
  readonly dayKeys: readonly string[];
  readonly onNext: () => void;
  readonly onPrevious: () => void;
  readonly onThisWeek: () => void;
  readonly showThisWeek: boolean;
}) {
  const theme = useTheme();
  return (
    <Card>
      <View style={styles.weekHeader}>
        <IconButton
          icon="chevron-left"
          label="Previous week"
          onPress={onPrevious}
          variant="surface"
        />
        <View style={styles.weekLabelWrap}>
          <Text style={[styles.weekLabel, { color: theme.text }]}>
            {weekRangeLabel(dayKeys)}
          </Text>
          {showThisWeek ? (
            <AnimatedPressable
              accessibilityLabel="Jump to this week"
              haptic="selection"
              onPress={onThisWeek}
            >
              <Text style={[styles.todayLink, { color: theme.primaryLight }]}>This week</Text>
            </AnimatedPressable>
          ) : null}
        </View>
        <IconButton
          icon="chevron-right"
          label="Next week"
          onPress={onNext}
          variant="surface"
        />
      </View>

      {conflicts > 0 ? (
        <View
          accessibilityRole="alert"
          style={[
            styles.conflictBanner,
            { backgroundColor: theme.dangerMuted, borderColor: theme.tint.danger.medium },
          ]}
        >
          <Feather color={theme.danger} name="alert-triangle" size={ICON.sm} />
          <Text style={[styles.conflictText, { color: theme.text }]}>
            {conflicts} day{conflicts === 1 ? "" : "s"} where a driver is carrying
            a load through time they marked off.
          </Text>
        </View>
      ) : null}
    </Card>
  );
}
