import { useEffect, useState } from "react";
import {
  Animated,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { makeStyles, RADIUS, SPACE, useReducedMotion } from "../../theme";

export type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const useStyles = makeStyles((theme) => ({
  skeleton: { backgroundColor: theme.surfaceElevated },
  card: {
    backgroundColor: theme.surface,
    borderRadius: RADIUS.lg,
    padding: SPACE.lg,
    borderWidth: 1,
    borderColor: theme.border,
    gap: SPACE.sm,
  },
  list: { gap: SPACE.md },
}));

/** Static or gently pulsing content placeholder, depending on Reduce Motion. */
export function Skeleton({ width = "100%", height = 16, borderRadius = RADIUS.sm, style, testID }: SkeletonProps) {
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(reduceMotion ? 0.45 : 0.3));

  useEffect(() => {
    if (reduceMotion) {
      opacity.stopAnimation();
      opacity.setValue(0.45);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { duration: 600, toValue: 0.62, useNativeDriver: true }),
        Animated.timing(opacity, { duration: 600, toValue: 0.3, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity, reduceMotion]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.skeleton, { width, height, borderRadius, opacity }, style]}
      testID={testID}
    />
  );
}

export type SkeletonCardProps = { lines?: number; style?: StyleProp<ViewStyle> };

export function SkeletonCard({ lines = 3, style }: SkeletonCardProps) {
  const styles = useStyles();
  return (
    <View accessible accessibilityLabel="Loading" accessibilityRole="progressbar" style={[styles.card, style]}>
      <Skeleton height={14} width="40%" />
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={`skeleton-line-${index}`} height={12} width={index === lines - 1 ? "60%" : "100%"} />
      ))}
    </View>
  );
}

export type SkeletonListProps = { count?: number; style?: StyleProp<ViewStyle> };

export function SkeletonList({ count = 4, style }: SkeletonListProps) {
  const styles = useStyles();
  return <View style={[styles.list, style]}>{Array.from({ length: count }, (_, index) => <SkeletonCard key={`skeleton-card-${index}`} />)}</View>;
}
