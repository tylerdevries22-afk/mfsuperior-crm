import type { ComponentProps, ReactNode } from "react";
import Feather from "@expo/vector-icons/Feather";
import {
  Image,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FONTS, makeStyles, SPACING, useTheme } from "../../theme";
import { AnimatedPressable } from "./AnimatedPressable";
import { NotificationButton } from "../notifications";

export type HeaderProps = {
  title?: string;
  subtitle?: string;
  /** Reference-app spelling. */
  showLogo?: boolean;
  /** MF compatibility spelling. */
  showBrand?: boolean;
  brandTagline?: string;
  showBack?: boolean;
  onBack?: () => void;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
  icon?: ComponentProps<typeof Feather>["name"];
  centered?: boolean;
  style?: StyleProp<ViewStyle>;
};

const useStyles = makeStyles((theme) => ({
  container: { backgroundColor: theme.background },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    minHeight: 56,
  },
  left: { flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0 },
  right: { flexDirection: "row", alignItems: "center" },
  back: { marginRight: SPACING.sm, minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  leftAction: { marginRight: SPACING.sm },
  logoRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, flex: 1, minWidth: 0 },
  logo: { width: 40, height: 40, borderRadius: 10 },
  brandName: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: theme.text,
    letterSpacing: 0.5,
  },
  brandSub: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: theme.textSecondary,
    letterSpacing: 0.3,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  titleBlock: { flexShrink: 1, minWidth: 0 },
  subtitle: {
    marginTop: 2,
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: theme.textSecondary,
  },
  centeredBlock: { alignItems: "center", flex: 1 },
  centeredTitle: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm },
  centeredSubtitle: { textAlign: "center" },
  titleIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: theme.tint.primary.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: theme.text,
    letterSpacing: 0.3,
  },
  border: { height: StyleSheet.hairlineWidth, backgroundColor: theme.border },
}));

/**
 * Shared compact header. Actual safe-area insets protect notches and landscape
 * cutouts without reserving an extra status-bar spacer in mobile browsers.
 */
export function Header({
  title,
  subtitle,
  showLogo = false,
  showBrand = false,
  brandTagline = "Freight • Logistics • Delivery",
  showBack = false,
  onBack,
  leftAction,
  rightAction,
  icon,
  centered = false,
  style,
}: HeaderProps) {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const theme = useTheme();
  const displaysLogo = showLogo || showBrand;
  const topPadding = insets.top;

  const backButton = showBack ? (
    <AnimatedPressable
      accessibilityLabel="Back"
      disabled={!onBack}
      hitSlop={8}
      onPress={onBack}
      style={styles.back}
    >
      <Feather color={theme.text} name="chevron-left" size={24} />
    </AnimatedPressable>
  ) : null;

  return (
    <View style={[styles.container, { paddingTop: topPadding }, style]}>
      <View style={[styles.inner, { paddingLeft: Math.max(insets.left, SPACING.xl), paddingRight: Math.max(insets.right, SPACING.xl) }]}>
        {centered ? backButton : (
          <View style={styles.left}>
            {leftAction ? <View style={styles.leftAction}>{leftAction}</View> : null}
            {backButton}
            {displaysLogo ? (
              <View style={styles.logoRow}>
                <Image resizeMode="cover" source={require("../../assets/brand/mf-logo-mark.png")} style={styles.logo} />
                <View style={styles.titleBlock}>
                  <Text accessibilityRole="header" style={styles.brandName}>MF Superior Products</Text>
                  <Text style={styles.brandSub}>{brandTagline}</Text>
                </View>
              </View>
            ) : title ? <TitleBlock icon={icon} subtitle={subtitle} title={title} /> : null}
          </View>
        )}

        {centered && !displaysLogo && title ? (
          <View style={styles.centeredBlock}>
            <TitleBlock centered icon={icon} subtitle={subtitle} title={title} />
          </View>
        ) : null}

        <View style={styles.right}>{rightAction}<NotificationButton /></View>
      </View>
      <View style={styles.border} />
    </View>
  );
}

function TitleBlock({
  title,
  subtitle,
  icon,
  centered = false,
}: Pick<HeaderProps, "title" | "subtitle" | "icon" | "centered">) {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <View style={styles.titleBlock}>
      <View style={[styles.titleRow, centered && styles.centeredTitle]}>
        {icon ? (
          <View style={styles.titleIcon}>
            <Feather color={theme.primaryLight} name={icon} size={18} />
          </View>
        ) : null}
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      </View>
      {subtitle ? <Text style={[styles.subtitle, centered && styles.centeredSubtitle]}>{subtitle}</Text> : null}
    </View>
  );
}
