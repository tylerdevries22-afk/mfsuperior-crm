import { Text, View, type StyleProp, type ViewStyle } from "react-native";

import { makeStyles, RADIUS, SPACE, TYPO, type ThemePalette } from "../../theme";

export type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";
export type BadgeSize = "sm" | "md";

export type BadgeProps = {
  label: string;
  tone?: BadgeTone;
  size?: BadgeSize;
  showDot?: boolean;
  style?: StyleProp<ViewStyle>;
};

type ToneColors = { backgroundColor: string; color: string };

function toneColors(theme: ThemePalette, tone: BadgeTone): ToneColors {
  const colors: Record<BadgeTone, ToneColors> = {
    neutral: { backgroundColor: theme.surfaceElevated, color: theme.textSecondary },
    brand: { backgroundColor: theme.tint.primary.muted, color: theme.primaryLight },
    success: { backgroundColor: theme.successMuted, color: theme.success },
    warning: { backgroundColor: theme.warningMuted, color: theme.warning },
    danger: { backgroundColor: theme.dangerMuted, color: theme.danger },
    info: { backgroundColor: theme.infoMuted, color: theme.info },
  };
  return colors[tone];
}

const useStyles = makeStyles((theme) => ({
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS.pill,
    gap: SPACE.xs,
  },
  sm: { minHeight: 24, paddingHorizontal: SPACE.sm, paddingVertical: SPACE.xxs },
  md: { minHeight: 30, paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs },
  dot: { width: 6, height: 6, borderRadius: RADIUS.pill },
  smText: { ...TYPO.subtitle, fontFamily: TYPO.captionStrong.fontFamily },
  mdText: { ...TYPO.captionStrong },
  neutral: toneColors(theme, "neutral"),
  brand: toneColors(theme, "brand"),
  success: toneColors(theme, "success"),
  warning: toneColors(theme, "warning"),
  danger: toneColors(theme, "danger"),
  info: toneColors(theme, "info"),
}));

/** Text-first status label; the optional dot never carries meaning alone. */
export function Badge({ label, tone = "neutral", size = "sm", showDot = false, style }: BadgeProps) {
  const styles = useStyles();
  const toneStyle = styles[tone];
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[styles.badge, styles[size], { backgroundColor: toneStyle.backgroundColor }, style]}
    >
      {showDot ? <View style={[styles.dot, { backgroundColor: toneStyle.color }]} /> : null}
      <Text style={[size === "sm" ? styles.smText : styles.mdText, { color: toneStyle.color }]}>
        {label}
      </Text>
    </View>
  );
}

const SUCCESS_STATUSES = new Set(["active", "accepted", "connected", "delivered", "completed", "won"]);
const WARNING_STATUSES = new Set(["simulated", "pending", "tendered", "not configured", "not_configured"]);
const DANGER_STATUSES = new Set(["declined", "rejected", "exception", "degraded", "failed", "lost"]);
const INFO_STATUSES = new Set(["assigned", "dispatched", "in transit", "in_transit", "arrived"]);

function inferTone(status: string): BadgeTone {
  const normalized = status.trim().toLowerCase();
  if (SUCCESS_STATUSES.has(normalized)) return "success";
  if (WARNING_STATUSES.has(normalized)) return "warning";
  if (DANGER_STATUSES.has(normalized)) return "danger";
  if (INFO_STATUSES.has(normalized)) return "info";
  return "neutral";
}

function statusLabel(status: string): string {
  return status.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export type StatusBadgeProps = {
  status: string;
  tone?: BadgeTone;
  size?: BadgeSize;
  showDot?: boolean;
};

/** Freight-aware status badge with an overridable semantic tone. */
export function StatusBadge({ status, tone, size, showDot = true }: StatusBadgeProps) {
  return <Badge label={statusLabel(status)} tone={tone ?? inferTone(status)} size={size} showDot={showDot} />;
}
