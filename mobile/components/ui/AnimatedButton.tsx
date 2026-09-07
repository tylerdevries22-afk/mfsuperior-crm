import { styles } from "./animatedButtonStyles";

import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Text,
  type GestureResponderEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { RADIUS, SPACING, useTheme } from "../../theme";
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
  md: { height: 48, paddingHorizontal: SPACING.xl, fontSize: 17 },
  lg: { height: 56, paddingHorizontal: SPACING.xxl, fontSize: 17 },
};

/**
 * A filled capsule in the tint colour, the way iOS draws a prominent action.
 * This replaced a ported five-band metallic treatment: stacked skewed colour
 * stops under a white bevel and a hard drop shadow, which read as two-tone in
 * light mode because its base stop was the dark olive `primaryLight`.
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
    borderRadius: RADIUS.pill,
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
        style={[containerStyle, { backgroundColor: theme.primary }, fullWidth && styles.fullWidth, style]}
        testID={testID}
      >
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
      container: { backgroundColor: "transparent", borderWidth: 1, borderColor: theme.primary },
      text: { color: theme.primaryLight },
    };
  }
  if (variant === "danger") {
    return { container: { backgroundColor: theme.dangerMuted }, text: { color: theme.danger } };
  }
  return { container: { backgroundColor: "transparent" }, text: { color: theme.primaryLight } };
}
