import { useEffect, useState, type ReactNode } from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";

import { EASE_ENTER, MOTION, useReducedMotion } from "../../theme";

export type FadeInViewProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  duration?: number;
  delay?: number;
  slideDistance?: number;
};

/** Quiet enter transition that becomes an immediate render under Reduce Motion. */
export function FadeInView({
  children,
  style,
  duration = MOTION.enterMs,
  delay = 0,
  slideDistance = 12,
}: FadeInViewProps) {
  const reduceMotion = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  const [translateY] = useState(() => new Animated.Value(reduceMotion ? 0 : slideDistance));

  useEffect(() => {
    opacity.setValue(reduceMotion ? 1 : 0);
    translateY.setValue(reduceMotion ? 0 : slideDistance);
    const animation = Animated.parallel([
      Animated.timing(opacity, { delay, duration: reduceMotion ? 0 : duration, easing: EASE_ENTER, toValue: 1, useNativeDriver: true }),
      Animated.timing(translateY, { delay, duration: reduceMotion ? 0 : duration, easing: EASE_ENTER, toValue: 0, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [delay, duration, opacity, reduceMotion, slideDistance, translateY]);

  return <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>{children}</Animated.View>;
}
