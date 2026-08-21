import type { ReactNode } from "react";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";

import { makeStyles, RADIUS, SIZE, SPACE, TYPO, useTheme, type ThemePalette } from "../../theme";
import { AnimatedPressable } from "./AnimatedPressable";

export type TimelineTone = "neutral" | "brand" | "success" | "warning" | "danger";

export type TimelineEntry = {
  id: string;
  title: string;
  subtitle?: string;
  timestamp?: string;
  tone?: TimelineTone;
  leading?: ReactNode;
  onPress?: () => void;
};

export type TimelineProps = {
  entries: readonly TimelineEntry[];
  empty?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

function toneColor(theme: ThemePalette, tone: TimelineTone): string {
  if (tone === "brand") return theme.primaryLight;
  if (tone === "success") return theme.success;
  if (tone === "warning") return theme.warning;
  if (tone === "danger") return theme.danger;
  return theme.textMuted;
}

const useStyles = makeStyles((theme) => ({
  timeline: { alignSelf: "stretch" },
  row: { minHeight: SIZE.row.default, flexDirection: "row", gap: SPACE.md },
  rail: { width: 20, alignItems: "center" },
  dot: { width: 10, height: 10, marginTop: SPACE.xs, borderRadius: RADIUS.pill, borderWidth: 2, borderColor: theme.surface },
  line: { flex: 1, width: 2, backgroundColor: theme.border },
  content: { flex: 1, minWidth: 0, paddingBottom: SPACE.lg },
  titleRow: { flexDirection: "row", alignItems: "baseline", gap: SPACE.sm },
  title: { ...TYPO.rowTitle, color: theme.text, flex: 1 },
  timestamp: { ...TYPO.subtitle, color: theme.textMuted },
  subtitle: { ...TYPO.caption, color: theme.textSecondary, marginTop: SPACE.xs },
  pressable: { minHeight: SIZE.hit },
}));

/**
 * Scannable freight-event timeline preserving the 20pt rail derived from
 * Appliance Diagnostic Systems commit 480991b7eb0036e4e85c37d3784b2de2ca97d10d.
 */
export function Timeline({ entries, empty = null, style, testID }: TimelineProps) {
  const styles = useStyles();
  if (entries.length === 0) return <>{empty}</>;
  return (
    <View accessibilityRole="list" style={[styles.timeline, style]} testID={testID}>
      {entries.map((entry, index) => (
        <TimelineRow entry={entry} isLast={index === entries.length - 1} key={entry.id} />
      ))}
    </View>
  );
}

function TimelineRow({ entry, isLast }: { entry: TimelineEntry; isLast: boolean }) {
  const styles = useStyles();
  const theme = useTheme();
  const content = (
    <>
      <View style={styles.rail}>
        <View style={[styles.dot, { backgroundColor: toneColor(theme, entry.tone ?? "neutral") }]} />
        {!isLast ? <View style={styles.line} /> : null}
      </View>
      <View style={styles.content}>
        <View style={styles.titleRow}>
          {entry.leading}
          <Text style={styles.title}>{entry.title}</Text>
          {entry.timestamp ? <Text style={styles.timestamp}>{entry.timestamp}</Text> : null}
        </View>
        {entry.subtitle ? <Text style={styles.subtitle}>{entry.subtitle}</Text> : null}
      </View>
    </>
  );
  return entry.onPress ? (
    <AnimatedPressable accessibilityLabel={entry.title} haptic="selection" onPress={entry.onPress} style={[styles.row, styles.pressable]}>
      {content}
    </AnimatedPressable>
  ) : <View accessibilityLabel={entry.title} accessibilityRole="summary" style={styles.row}>{content}</View>;
}
