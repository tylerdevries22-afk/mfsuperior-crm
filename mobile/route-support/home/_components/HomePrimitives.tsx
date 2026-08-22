import { Feather } from "@expo/vector-icons";
import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { AnimatedPressable } from "@/components/ui";
import { THEME } from "@/theme";

import { s } from "../homeStyles";

/**
 * Ported from the Appliance Diagnostic Systems home helpers at
 * 480991b7eb0036e4e85c37d3784b2de2ca97d10d — same timings, same geometry.
 */

export function PulseOrb({ color, delay = 0 }: { readonly color: string; readonly delay?: number }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.6, { duration: 1800, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      ),
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(withTiming(0.15, { duration: 1800 }), withTiming(0.6, { duration: 1200 })),
        -1,
        true,
      ),
    );
  }, [delay, opacity, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        { position: "absolute", width: 8, height: 8, borderRadius: 4, backgroundColor: color },
        animStyle,
      ]}
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
