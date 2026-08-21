import { Text, View, type StyleProp, type ViewStyle } from "react-native";

import { makeStyles, RADIUS, SPACE, TYPO } from "../../theme";
import { PressableSurface } from "./PressableSurface";

export type StatTileProps = {
  label: string;
  value: string;
  current?: number;
  previous?: number;
  hint?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

const useStyles = makeStyles((theme) => ({
  tile: {
    flexGrow: 1,
    flexBasis: "46%",
    minHeight: 96,
    borderRadius: RADIUS.md,
    backgroundColor: theme.tint.primary.muted,
    padding: SPACE.md,
    gap: 2,
    justifyContent: "center",
  },
  label: { ...TYPO.captionStrong, color: theme.textSecondary },
  value: { ...TYPO.metric, color: theme.text },
  footer: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  hint: { ...TYPO.subtitle, color: theme.textMuted },
  positive: { ...TYPO.captionStrong, color: theme.success },
  negative: { ...TYPO.captionStrong, color: theme.danger },
}));

/** Calculate a rounded percentage change, or null when no baseline exists. */
export function deltaPercent(current: number, previous?: number): number | null {
  if (previous === undefined || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** KPI tile for two-column overview grids. */
export function StatTile({ label, value, current, previous, hint, onPress, style }: StatTileProps) {
  const styles = useStyles();
  const delta = current === undefined ? null : deltaPercent(current, previous);
  const content = (
    <>
      <Text style={styles.label}>{label}</Text>
      <Text adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={1} style={styles.value}>{value}</Text>
      {delta !== null || hint ? (
        <View style={styles.footer}>
          {delta !== null ? <Text style={delta >= 0 ? styles.positive : styles.negative}>{delta >= 0 ? "+" : ""}{delta}%</Text> : null}
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        </View>
      ) : null}
    </>
  );

  if (!onPress) return <View accessible accessibilityLabel={`${label}, ${value}`} style={[styles.tile, style]}>{content}</View>;
  return <PressableSurface accessibilityLabel={`${label}, ${value}`} haptic="selection" onPress={onPress} style={[styles.tile, style]}>{content}</PressableSurface>;
}
