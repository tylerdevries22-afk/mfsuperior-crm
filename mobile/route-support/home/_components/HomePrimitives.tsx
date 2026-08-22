import { Feather } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated, Easing, Text, View } from "react-native";

import { AnimatedPressable } from "@/components/ui";
import { THEME, useReducedMotion } from "@/theme";

import { s } from "../homeStyles";

/**
 * Ported from the Appliance Diagnostic Systems home helpers at
 * 480991b7eb0036e4e85c37d3784b2de2ca97d10d — same timings, same geometry.
 */

/**
 * The reference drives this with Reanimated shared values. Every other
 * animation in this app uses React Native's `Animated`, and this was the only
 * Reanimated call site, so it is expressed with the same primitive rather than
 * resting on a worklets plugin nothing else needs. Timings are unchanged.
 *
 * The loop is decorative emphasis, not information, so Reduce Motion leaves
 * the orb at rest.
 */
export function PulseOrb({ color, delay = 0 }: { readonly color: string; readonly delay?: number }) {
  const progress = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          delay,
          duration: 1800,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, progress, reduceMotion]);

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const opacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0.15] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: color,
        opacity,
        transform: [{ scale }],
      }}
    />
  );
}

export function StatPill({
  icon,
  label,
  value,
  color,
  onPress,
}: {
  readonly icon: keyof typeof Feather.glyphMap;
  readonly label: string;
  readonly value: string;
  readonly color: string;
  readonly onPress?: () => void;
}) {
  return (
    <AnimatedPressable
      accessibilityLabel={`${label}: ${value}`}
      accessibilityRole="button"
      haptic="selection"
      onPress={onPress}
      style={s.statPill}
    >
      <View style={[s.statDot, { backgroundColor: `${color}30` }]}>
        <Feather color={color} name={icon} size={14} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.statValue}>{value}</Text>
        <Text style={s.statLabel}>{label}</Text>
      </View>
    </AnimatedPressable>
  );
}

export function InlineError({
  message,
  onRetry,
}: {
  readonly message: string;
  readonly onRetry: () => void;
}) {
  return (
    <AnimatedPressable
      accessibilityLabel={`${message}. Retry.`}
      accessibilityRole="button"
      haptic="selection"
      onPress={onRetry}
      style={s.inlineError}
    >
      <Feather color={THEME.danger} name="alert-circle" size={14} />
      <Text style={s.inlineErrorText}>{message}</Text>
      <Feather color={THEME.textMuted} name="refresh-cw" size={12} />
    </AnimatedPressable>
  );
}
