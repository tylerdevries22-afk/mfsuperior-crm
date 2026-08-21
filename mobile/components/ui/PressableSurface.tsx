import type { ReactNode } from "react";
import { type PressableProps, type StyleProp, type ViewStyle } from "react-native";

import { MOTION } from "../../theme";
import { AnimatedPressable, type HapticStrength } from "./AnimatedPressable";

export type { HapticStrength } from "./AnimatedPressable";

export type PressableSurfaceProps = Omit<PressableProps, "children" | "style"> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleValue?: number;
  pressedOpacity?: number;
  haptic?: HapticStrength;
  ensureMinTarget?: boolean;
};

/** Freight-surface wrapper that keeps the legacy `PressableSurface` API. */
export function PressableSurface({
  children,
  style,
  scaleValue = MOTION.pressScale,
  pressedOpacity = 0.72,
  haptic = "none",
  ensureMinTarget = true,
  disabled,
  onPress,
  ...props
}: PressableSurfaceProps) {
  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      ensureMinTarget={ensureMinTarget}
      haptic={haptic}
      onPress={onPress}
      opacityValue={pressedOpacity}
      scaleValue={scaleValue}
      style={style}
    >
      {children}
    </AnimatedPressable>
  );
}
