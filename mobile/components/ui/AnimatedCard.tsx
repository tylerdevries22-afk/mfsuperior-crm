import type { ReactNode } from "react";
import { View, type GestureResponderEvent, type StyleProp, type ViewStyle } from "react-native";

import { CARD_SHADOW_SM, RADIUS_LEGACY, SPACING, useTheme } from "../../theme";
import { AnimatedPressable, type HapticStrength } from "./AnimatedPressable";

export type CardElevation = "flat" | "sm" | "md";

export type AnimatedCardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: (event: GestureResponderEvent) => void;
  elevation?: CardElevation;
  haptic?: HapticStrength;
  scaleValue?: number;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * Legacy card primitive ported from Appliance Diagnostic Systems commit
 * 480991b7eb0036e4e85c37d3784b2de2ca97d10d with its exact 14pt radius and
 * 16pt inset preserved.
 */
export function AnimatedCard({
  children,
  style,
  onPress,
  elevation = "sm",
  haptic = "selection",
  scaleValue = 0.98,
  disabled = false,
  accessibilityLabel,
  testID,
}: AnimatedCardProps) {
  const theme = useTheme();
  const baseStyle: ViewStyle = {
    backgroundColor: theme.surface,
    borderRadius: RADIUS_LEGACY.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: theme.border,
  };
  const elevationStyle = elevation === "flat"
    ? undefined
    : elevation === "sm"
      ? CARD_SHADOW_SM
      : {
          shadowColor: theme.shadow.color,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 6,
        } satisfies ViewStyle;

  if (!onPress) {
    return <View style={[baseStyle, elevationStyle, style]} testID={testID}>{children}</View>;
  }
  return (
    <AnimatedPressable
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      haptic={haptic}
      onPress={onPress}
      scaleValue={scaleValue}
      style={[baseStyle, elevationStyle, style]}
      testID={testID}
    >
      {children}
    </AnimatedPressable>
  );
}
