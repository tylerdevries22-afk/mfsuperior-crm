import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { FONTS, RADIUS_LEGACY as RADIUS, THEME, useReducedMotion } from "@/theme";

/**
 * Draggable map sheet.
 *
 * Snap points, handle height, corner radius, and spring feel are taken from
 * the actz-may marketplace bottom sheet so the two products present a map the
 * same way. That sheet is a web component built on Framer Motion; this is the
 * React Native equivalent expressed with `Animated` and `PanResponder`, which
 * is what every other animation in this app uses.
 */

const SNAP_POINTS = { collapsed: 0.08, half: 0.5, expanded: 1.0 } as const;
const DRAG_HANDLE_HEIGHT = 28;
const CORNER_RADIUS = 16;
const MIN_DRAG_TO_SNAP = 20;
const SPRING = { stiffness: 500, damping: 45, mass: 0.6 };

export type SheetPosition = keyof typeof SNAP_POINTS;

export function MapBottomSheet({
  children,
  title,
  subtitle,
  initialPosition = "half",
}: {
  readonly children: ReactNode;
  readonly title: string;
  readonly subtitle?: string;
  readonly initialPosition?: SheetPosition;
}) {
  const screenHeight = Dimensions.get("window").height;
  const heightFor = useCallback(
    (position: SheetPosition) => screenHeight * SNAP_POINTS[position],
    [screenHeight],
  );

  const reduceMotion = useReducedMotion();
  const [position, setPosition] = useState<SheetPosition>(initialPosition);
  const height = useRef(new Animated.Value(heightFor(initialPosition))).current;
  const heightValue = useRef(heightFor(initialPosition));

  useEffect(() => {
    const id = height.addListener(({ value }) => {
      heightValue.current = value;
    });
    return () => height.removeListener(id);
  }, [height]);

  const settle = useCallback(
    (next: SheetPosition) => {
      setPosition(next);
      if (reduceMotion) {
        height.setValue(heightFor(next));
        return;
      }
      Animated.spring(height, {
        toValue: heightFor(next),
        stiffness: SPRING.stiffness,
        damping: SPRING.damping,
        mass: SPRING.mass,
        useNativeDriver: false,
      }).start();
    },
    [height, heightFor, reduceMotion],
  );

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4,
      onPanResponderMove: (_e, g) => {
        // Dragging up grows the sheet, so the delta is inverted.
        const next = heightValue.current - g.dy;
        const clamped = Math.max(
          screenHeight * SNAP_POINTS.collapsed,
          Math.min(next, screenHeight * SNAP_POINTS.expanded),
        );
        height.setValue(clamped);
      },
      onPanResponderRelease: (_e, g) => {
        const current = heightValue.current;
        if (Math.abs(g.dy) < MIN_DRAG_TO_SNAP) {
          settle(nearest(current, screenHeight));
          return;
        }
        settle(
          g.dy < 0
            ? next(nearest(current, screenHeight), "up")
            : next(nearest(current, screenHeight), "down"),
        );
      },
    }),
  ).current;

  return (
    <Animated.View style={[styles.sheet, { height }]}>
      <View {...panResponder.panHandlers} style={styles.handleArea}>
        <View style={styles.handle} />
      </View>
      <View style={styles.header}>
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={[styles.body, position === "collapsed" && styles.bodyHidden]}>{children}</View>
    </Animated.View>
  );
}

function nearest(height: number, screenHeight: number): SheetPosition {
  const entries = Object.entries(SNAP_POINTS) as [SheetPosition, number][];
  return entries.reduce((best, [key, ratio]) =>
    Math.abs(screenHeight * ratio - height) < Math.abs(screenHeight * SNAP_POINTS[best] - height)
      ? key
      : best,
  "half" as SheetPosition);
}

function next(from: SheetPosition, direction: "up" | "down"): SheetPosition {
  const order: SheetPosition[] = ["collapsed", "half", "expanded"];
  const index = order.indexOf(from);
  const target = direction === "up" ? index + 1 : index - 1;
  return order[Math.max(0, Math.min(order.length - 1, target))];
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: 16 },
  bodyHidden: { opacity: 0 },
  handle: {
    backgroundColor: THEME.textMuted,
    borderRadius: 3,
    height: 5,
    opacity: 0.6,
    width: 44,
  },
  handleArea: {
    alignItems: "center",
    height: DRAG_HANDLE_HEIGHT,
    justifyContent: "center",
  },
  header: { paddingBottom: 8, paddingHorizontal: 16 },
  sheet: {
    backgroundColor: THEME.surface,
    borderColor: THEME.border,
    borderTopLeftRadius: CORNER_RADIUS,
    borderTopRightRadius: CORNER_RADIUS,
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
  },
  subtitle: { color: THEME.textSecondary, fontFamily: FONTS.regular, fontSize: 13, marginTop: 2 },
  title: { color: THEME.text, fontFamily: FONTS.bold, fontSize: 17 },
});

export { SNAP_POINTS, CORNER_RADIUS, DRAG_HANDLE_HEIGHT, RADIUS };
