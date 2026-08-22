import type { ReactNode } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { FONTS, RADIUS_LEGACY, SPACING, useTheme } from "../../theme";
import {
  AnimatedPressable,
  type HapticStrength,
} from "./AnimatedPressable";

export type AnimatedButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type AnimatedButtonSize = "sm" | "md" | "lg";

export type AnimatedButtonProps = {
  title: string;
  onPress?: (event: GestureResponderEvent) => void;
  variant?: AnimatedButtonVariant;
  size?: AnimatedButtonSize;
  disabled?: boolean;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  haptic?: HapticStrength;
  loading?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

const MIN_TOUCH_TARGET = 44;

const SIZE_CONFIG: Record<AnimatedButtonSize, { height: number; paddingHorizontal: number; fontSize: number }> = {
  sm: { height: 36, paddingHorizontal: SPACING.md, fontSize: 13 },
  md: { height: 48, paddingHorizontal: SPACING.xl, fontSize: 15 },
  lg: { height: 56, paddingHorizontal: SPACING.xxl, fontSize: 16 },
};

/**
 * Appliance Diagnostic Systems' metallic button geometry, ported from commit
 * 480991b7eb0036e4e85c37d3784b2de2ca97d10d and recolored in MF lime/olive.
 * Layered native views preserve the five-stop treatment without adding a
 * gradient runtime dependency.
 */
export function AnimatedButton({
  title,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  icon,
  iconPosition = "left",
  style,
  textStyle,
  haptic = "medium",
  loading = false,
  fullWidth = false,
  accessibilityLabel,
  testID,
}: AnimatedButtonProps) {
  const theme = useTheme();
  const sizeConfig = SIZE_CONFIG[size];
  const isDisabled = disabled || loading;
  const containerStyle: ViewStyle = {
    height: sizeConfig.height,
    borderRadius: RADIUS_LEGACY.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    opacity: isDisabled ? 0.5 : 1,
    overflow: "hidden",
  };
  const hitSlop = sizeConfig.height < MIN_TOUCH_TARGET
    ? (MIN_TOUCH_TARGET - sizeConfig.height) / 2
    : undefined;

  if (variant === "primary") {
    return (
      <AnimatedPressable
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityState={{ busy: loading, disabled: isDisabled }}
        disabled={isDisabled}
        ensureMinTarget={false}
        haptic={haptic}
        hitSlop={hitSlop}
        onPress={onPress}
        scaleValue={0.96}
        style={[containerStyle, styles.metalShadow, fullWidth && styles.fullWidth, style]}
        testID={testID}
      >
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.primaryLight }]} />
        <View pointerEvents="none" style={[styles.gradientStop, styles.stopTwo, { backgroundColor: theme.primary }]} />
        <View pointerEvents="none" style={[styles.gradientStop, styles.stopThree, { backgroundColor: theme.accent }]} />
        <View pointerEvents="none" style={[styles.gradientStop, styles.stopFour, { backgroundColor: theme.primaryDark }]} />
        <View pointerEvents="none" style={[styles.gradientStop, styles.stopFive, { backgroundColor: theme.steel }]} />
        <View pointerEvents="none" style={styles.topHighlight} />
        <View pointerEvents="none" style={[styles.metalBorder, { borderColor: theme.tint.primaryLight.strong }]} />
        {loading ? <ActivityIndicator color={theme.primaryForeground} /> : null}
        {!loading && iconPosition === "left" ? icon : null}
        {!loading ? (
          <Text
            style={[
              styles.primaryText,
              {
                color: theme.primaryForeground,
                fontSize: sizeConfig.fontSize,
                paddingHorizontal: sizeConfig.paddingHorizontal,
              },
              textStyle,
            ]}
          >
            {title}
          </Text>
        ) : null}
        {!loading && iconPosition === "right" ? icon : null}
      </AnimatedPressable>
    );
  }

  const variantStyles = variantAppearance(variant, theme);
  return (
    <AnimatedPressable
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ busy: loading, disabled: isDisabled }}
      disabled={isDisabled}
      ensureMinTarget={false}
      haptic={haptic}
      hitSlop={hitSlop}
      onPress={onPress}
      scaleValue={0.97}
      style={[
        containerStyle,
        { paddingHorizontal: sizeConfig.paddingHorizontal },
        variantStyles.container,
        fullWidth && styles.fullWidth,
        style,
      ]}
      testID={testID}
    >
      {loading ? <ActivityIndicator color={variantStyles.text.color} /> : null}
      {!loading && iconPosition === "left" ? icon : null}
      {!loading ? (
        <Text style={[styles.variantText, { fontSize: sizeConfig.fontSize }, variantStyles.text, textStyle]}>
          {title}
        </Text>
      ) : null}
      {!loading && iconPosition === "right" ? icon : null}
    </AnimatedPressable>
  );
}

type ThemeForButton = ReturnType<typeof useTheme>;

function variantAppearance(
  variant: Exclude<AnimatedButtonVariant, "primary">,
  theme: ThemeForButton,
): { container: ViewStyle; text: TextStyle } {
  if (variant === "secondary") {
    return {
      container: { backgroundColor: theme.surfaceElevated, borderWidth: 1, borderColor: theme.border },
      text: { color: theme.text },
    };
  }
  if (variant === "outline") {
    return {
      container: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: theme.primary },
      text: { color: theme.primaryLight },
    };
  }
  if (variant === "danger") {
    return { container: { backgroundColor: theme.dangerMuted }, text: { color: theme.danger } };
  }
  return { container: { backgroundColor: "transparent" }, text: { color: theme.primaryLight } };
}

const styles = StyleSheet.create({
  fullWidth: { alignSelf: "stretch" },
  gradientStop: {
    bottom: -12,
    position: "absolute",
    right: -24,
    top: -12,
    transform: [{ skewX: "-12deg" }],
  },
  stopTwo: { width: "82%" },
  stopThree: { width: "62%" },
  stopFour: { width: "42%" },
  stopFive: { width: "22%" },
  topHighlight: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderTopLeftRadius: RADIUS_LEGACY.lg,
    borderTopRightRadius: RADIUS_LEGACY.lg,
    height: "45%",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  metalShadow: {
    elevation: 10,
    shadowColor: "#DCE9AD",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 2,
  },
  metalBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADIUS_LEGACY.lg,
    borderWidth: 1.5,
  },
  primaryText: {
    fontFamily: FONTS.bold,
    letterSpacing: 0.3,
    textShadowColor: "rgba(255,255,255,0.18)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  variantText: { fontFamily: FONTS.bold, letterSpacing: 0.2 },
});
