import type { ReactNode } from "react";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import Feather from "@expo/vector-icons/Feather";

import { ICON, makeStyles, RADIUS, SIZE, SPACE, TYPO, useTheme } from "../../theme";
import { PressableSurface } from "./PressableSurface";

export type ListProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export type ListRowProps = {
  title: string;
  subtitle?: string;
  meta?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  compact?: boolean;
  rich?: boolean;
  isLast?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const useStyles = makeStyles((theme) => ({
  list: {
    overflow: "hidden",
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  row: {
    minHeight: SIZE.row.default,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
  },
  compact: { minHeight: SIZE.row.compact },
  rich: { minHeight: SIZE.row.rich, alignItems: "flex-start", paddingVertical: SPACE.md },
  disabled: { opacity: 0.48 },
  body: { flex: 1, minWidth: 0, justifyContent: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  title: { ...TYPO.rowTitle, color: theme.text, flex: 1 },
  meta: { ...TYPO.captionStrong, color: theme.textSecondary },
  subtitle: { ...TYPO.caption, color: theme.textSecondary, marginTop: 2 },
  leading: { alignItems: "center", justifyContent: "center" },
  trailing: { minWidth: ICON.md, alignItems: "flex-end", justifyContent: "center" },
  divider: { height: 1, backgroundColor: theme.border, marginLeft: SPACE.md },
  keyValue: {
    minHeight: SIZE.hit,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACE.md,
  },
  key: { ...TYPO.caption, color: theme.textSecondary, flex: 1 },
  value: { ...TYPO.captionStrong, color: theme.text, flex: 1.5, textAlign: "right" },
}));

/** Bordered list container for related freight records. */
export function List({ children, style, accessibilityLabel }: ListProps) {
  const styles = useStyles();
  return <View accessibilityLabel={accessibilityLabel} style={[styles.list, style]}>{children}</View>;
}

/** Scannable record row with a 44-point minimum target and optional navigation affordance. */
export function ListRow({
  title,
  subtitle,
  meta,
  leading,
  trailing,
  onPress,
  compact = false,
  rich = false,
  isLast = false,
  disabled = false,
  accessibilityLabel,
  style,
}: ListRowProps) {
  const styles = useStyles();
  const theme = useTheme();
  const label = accessibilityLabel ?? [title, subtitle, meta].filter(Boolean).join(", ");
  const rowStyle = [styles.row, compact && styles.compact, rich && styles.rich, disabled && styles.disabled, style];
  const content = (
    <>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        </View>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.trailing}>
        {trailing ?? (onPress ? <Feather name="chevron-right" size={ICON.md} color={theme.textMuted} /> : null)}
      </View>
    </>
  );

  return (
    <>
      {onPress ? (
        <PressableSurface accessibilityLabel={label} disabled={disabled} haptic="selection" onPress={onPress} style={rowStyle}>
          {content}
        </PressableSurface>
      ) : <View accessible accessibilityLabel={label} style={rowStyle}>{content}</View>}
      {!isLast ? <View style={styles.divider} /> : null}
    </>
  );
}

export type KeyValueRowProps = { label: string; value: string; isLast?: boolean };

export function KeyValueRow({ label, value, isLast = false }: KeyValueRowProps) {
  const styles = useStyles();
  return (
    <>
      <View accessible accessibilityLabel={`${label}, ${value}`} style={styles.keyValue}>
        <Text style={styles.key}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
      {!isLast ? <View style={styles.divider} /> : null}
    </>
  );
}

export const Row = ListRow;
