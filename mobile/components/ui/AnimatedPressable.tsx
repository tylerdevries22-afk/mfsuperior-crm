import { useCallback, useState, type ReactNode } from "react";
import * as Haptics from "expo-haptics";
import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { ANIM, SIZE, useReducedMotion } from "../../theme";

export type HapticStrength = "none" | "selection" | "light" | "medium";

export type AnimatedPressableProps = Omit<PressableProps, "children" | "style"> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleValue?: number;
  opacityValue?: number;
  haptic?: HapticStrength;
  ensureMinTarget?: boolean;
};

function playHaptic(strength: HapticStrength): void {
  const feedback = strength === "selection"
    ? Haptics.selectionAsync()
    : strength === "light"
      ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      : strength === "medium"
        ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        : undefined;
  if (feedback) void feedback.catch(() => undefined);
}

/**
 * Press-feedback primitive ported from Appliance Diagnostic Systems commit
 * 480991b7eb0036e4e85c37d3784b2de2ca97d10d. Reduce Motion removes scale but
 * deliberately retains opacity feedback.
 */
export function AnimatedPressable({
  children,
  style,
  onPressIn,
  onPressOut,
  onPress,
  accessibilityRole,
  accessibilityState,
  scaleValue = ANIM.pressScale,
  opacityValue = 0.85,
  haptic = "none",
  ensureMinTarget = true,
  disabled,
  ...rest
}: AnimatedPressableProps) {
  const [pressed, setPressed] = useState(false);
  const reduceMotion = useReducedMotion();

  const handlePressIn = useCallback((event: GestureResponderEvent) => {
    setPressed(true);
    onPressIn?.(event);
  }, [onPressIn]);

  const handlePressOut = useCallback((event: GestureResponderEvent) => {
    setPressed(false);
    onPressOut?.(event);
  }, [onPressOut]);

  const handlePress = useCallback((event: GestureResponderEvent) => {
    playHaptic(haptic);
    onPress?.(event);
  }, [haptic, onPress]);

  return (
    <Pressable
      {...rest}
      accessibilityRole={accessibilityRole ?? "button"}
      accessibilityState={{
        ...accessibilityState,
        disabled: Boolean(disabled || accessibilityState?.disabled),
      }}
      disabled={disabled}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        ensureMinTarget && { minHeight: SIZE.hit, minWidth: SIZE.hit },
        style,
        pressed && {
          opacity: opacityValue,
          transform: reduceMotion ? undefined : [{ scale: scaleValue }],
        },
      ]}
    >
      {children}
    </Pressable>
  );
}
