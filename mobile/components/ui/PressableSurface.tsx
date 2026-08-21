import type { ReactNode } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";

import { MOTION, SIZE, useReducedMotion } from "../../theme";

export type HapticStrength = "none" | "selection" | "light" | "medium";

export type PressableSurfaceProps = Omit<PressableProps, "children" | "style"> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleValue?: number;
  pressedOpacity?: number;
  haptic?: HapticStrength;
  ensureMinTarget?: boolean;
};

async function playHaptic(strength: HapticStrength): Promise<void> {
  if (strength === "selection") {
    await Haptics.selectionAsync();
  } else if (strength === "light") {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } else if (strength === "medium") {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
}

/** Shared press feedback with haptics and an OS Reduce Motion fallback. */
export function PressableSurface({
  children,
  style,
  scaleValue = MOTION.pressScale,
  pressedOpacity = 0.72,
  haptic = "none",
  ensureMinTarget = true,
  disabled,
  onPress,
  accessibilityRole,
  accessibilityState,
  ...props
}: PressableSurfaceProps) {
  const reduceMotion = useReducedMotion();

  return (
    <Pressable
      {...props}
      accessibilityRole={accessibilityRole ?? "button"}
      accessibilityState={{
        ...accessibilityState,
        disabled: Boolean(disabled || accessibilityState?.disabled),
      }}
      disabled={disabled}
      onPress={(event) => {
        if (haptic !== "none") void playHaptic(haptic).catch(() => undefined);
        onPress?.(event);
      }}
      style={({ pressed }) => [
        ensureMinTarget && { minHeight: SIZE.hit, minWidth: SIZE.hit },
        style,
        pressed && {
          opacity: pressedOpacity,
          transform: reduceMotion ? undefined : [{ scale: scaleValue }],
        },
      ]}
    >
      {children}
    </Pressable>
  );
}

/** Compatibility alias for Appliance Diagnostic-derived screens. */
export const AnimatedPressable = PressableSurface;
