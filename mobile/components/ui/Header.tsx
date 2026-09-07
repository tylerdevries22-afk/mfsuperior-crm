import type { ComponentProps, ReactNode } from "react";
import Feather from "@expo/vector-icons/Feather";
import { Image, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HAIRLINE, makeStyles, RADIUS, SPACE, TYPO, useTheme } from "../../theme";
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
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.xs,
    minHeight: 52,
  },
  left: { flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0 },
  right: { flexDirection: "row", alignItems: "center" },
  back: { marginRight: SPACE.xxs, minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  leftAction: { marginRight: SPACE.xs },
  logoRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, flex: 1, minWidth: 0 },
  logo: { width: 36, height: 36, borderRadius: RADIUS.sm },
  brandName: { ...TYPO.heading, color: theme.text },
  brandSub: { ...TYPO.caption, color: theme.textSecondary },
  titleRow: { flexDirection: "row", alignItems: "center", gap: SPACE.xs, minWidth: 0 },
  titleBlock: { flexShrink: 1, minWidth: 0 },
  subtitle: { ...TYPO.caption, marginTop: 1, color: theme.textSecondary },
  centeredBlock: { alignItems: "center", flex: 1, minWidth: 0 },
  /**
   * A centred title sizes to its content, which would let a long one spill out
   * of the block and slide under the trailing actions. Stretching it to the
   * block's own width keeps the truncation inside the space that is actually free.
   */
  centeredTitleBlock: { alignSelf: "stretch", minWidth: 0 },
  centeredTitle: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.xs },
  centeredSubtitle: { textAlign: "center" },
  titleIcon: {
    width: 30,
    height: 30,
    borderRadius: RADIUS.sm,
    backgroundColor: theme.tint.primary.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  /** iOS inline navigation-bar titles are Headline (17pt semibold), not display type. */
  title: { ...TYPO.cardTitle, color: theme.text, flexShrink: 1, minWidth: 0 },
  border: { height: HAIRLINE, backgroundColor: theme.separator },
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
      <View style={[styles.inner, { paddingLeft: Math.max(insets.left, SPACE.md), paddingRight: Math.max(insets.right, SPACE.md) }]}>
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
    <View style={[styles.titleBlock, centered && styles.centeredTitleBlock]}>
      <View style={[styles.titleRow, centered && styles.centeredTitle]}>
        {icon ? (
          <View style={styles.titleIcon}>
            <Feather color={theme.primaryLight} name={icon} size={18} />
          </View>
        ) : null}
        <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>{title}</Text>
      </View>
      {subtitle ? <Text numberOfLines={1} style={[styles.subtitle, centered && styles.centeredSubtitle]}>{subtitle}</Text> : null}
    </View>
  );
}
