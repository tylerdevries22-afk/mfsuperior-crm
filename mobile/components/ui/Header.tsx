import type { ReactNode } from "react";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { ICON, makeStyles, RADIUS_DENSE, SIZE, SPACE, TYPO, useTheme } from "../../theme";
import { PressableSurface } from "./PressableSurface";

export type HeaderProps = {
  title?: string;
  subtitle?: string;
  showBrand?: boolean;
  brandTagline?: string;
  showBack?: boolean;
  onBack?: () => void;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
  centered?: boolean;
  style?: StyleProp<ViewStyle>;
};

const useStyles = makeStyles((theme) => ({
  safeArea: { backgroundColor: theme.background, borderBottomWidth: 1, borderBottomColor: theme.border },
  inner: {
    minHeight: 64,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
  },
  side: { minWidth: SIZE.hit, flexDirection: "row", alignItems: "center" },
  right: { justifyContent: "flex-end" },
  titleBlock: { flex: 1, minWidth: 0 },
  centered: { alignItems: "center" },
  title: { ...TYPO.heading, color: theme.text },
  centeredText: { textAlign: "center" },
  subtitle: { ...TYPO.subtitle, color: theme.textSecondary, marginTop: 2 },
  brandRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: RADIUS_DENSE.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.primary,
  },
  brandLetters: { ...TYPO.captionStrong, color: theme.primaryForeground },
  brandName: { ...TYPO.cardTitle, color: theme.text },
  back: { alignItems: "center", justifyContent: "center" },
}));

/** Safe-area app header matching the reference app's title and action geometry. */
export function Header({
  title,
  subtitle,
  showBrand = false,
  brandTagline = "Freight operations",
  showBack = false,
  onBack,
  leftAction,
  rightAction,
  centered = false,
  style,
}: HeaderProps) {
  const styles = useStyles();
  const theme = useTheme();
  const left = showBack ? (
    <PressableSurface accessibilityLabel="Back" disabled={!onBack} onPress={onBack} style={styles.back}>
      <Ionicons name="chevron-back" size={ICON.lg} color={theme.text} />
    </PressableSurface>
  ) : leftAction ? <View style={styles.side}>{leftAction}</View> : centered ? <View style={styles.side} /> : null;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.safeArea, style]}>
      <View style={styles.inner}>
        {left}
        {showBrand ? (
          <View style={styles.brandRow}>
            <View accessible={false} style={styles.brandMark}><Text style={styles.brandLetters}>MF</Text></View>
            <View style={styles.titleBlock}>
              <Text accessibilityRole="header" style={styles.brandName}>MF Superior</Text>
              <Text style={styles.subtitle}>{brandTagline}</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.titleBlock, centered && styles.centered]}>
            {title ? <Text accessibilityRole="header" style={[styles.title, centered && styles.centeredText]}>{title}</Text> : null}
            {subtitle ? <Text style={[styles.subtitle, centered && styles.centeredText]}>{subtitle}</Text> : null}
          </View>
        )}
        {rightAction ? <View style={[styles.side, styles.right]}>{rightAction}</View> : centered ? <View style={styles.side} /> : null}
      </View>
    </SafeAreaView>
  );
}
