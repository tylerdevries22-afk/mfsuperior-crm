import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

/**
 * Ratios from the actz-may sheet. `expanded` stops short of the full viewport
 * on purpose: at 1.0 the sheet's top lands at y=0, putting the grab handle
 * behind the status bar with nothing left to pull down. Capping it also keeps
 * the screen's own header visible, which is how system sheets behave.
 */
const SNAP_POINTS = { collapsed: 0.08, half: 0.5, expanded: 0.92 } as const;

/** Never let the sheet's top cross into the status bar, whatever the ratio. */
const MIN_TOP_GAP = 8;
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
  position: controlledPosition,
  onPositionChange,
  topInset,
}: {
  readonly children: ReactNode;
  readonly title: string;
  readonly subtitle?: string;
  readonly initialPosition?: SheetPosition;
  /** Drives the sheet from outside; the sheet still snaps on its own drags. */
  readonly position?: SheetPosition;
  readonly onPositionChange?: (position: SheetPosition) => void;
  /**
   * Points from the top of the screen the sheet must never rise past. Pass the
   * screen header's measured height so the header stays readable at every snap
   * — without it the sheet would swallow the title of the screen it belongs to.
   */
  readonly topInset?: number;
}) {
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const maxHeight = screenHeight - Math.max(topInset ?? 0, insets.top) - MIN_TOP_GAP;
  const heightFor = useCallback(
    (target: SheetPosition) => Math.min(screenHeight * SNAP_POINTS[target], maxHeight),
    [maxHeight, screenHeight],
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
      onPositionChange?.(next);
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
    [height, heightFor, onPositionChange, reduceMotion],
  );

  // An outside caller (a map tap, say) can drive the sheet; ignore the echo of
  // a position the sheet already holds so it does not fight its own drag.
  const settleRef = useRef(settle);
  settleRef.current = settle;
  useEffect(() => {
    if (!controlledPosition || controlledPosition === position) return;
    settleRef.current(controlledPosition);
  }, [controlledPosition, position]);

  // PanResponder is created once, so live values reach it through refs.
  const maxHeightRef = useRef(maxHeight);
  maxHeightRef.current = maxHeight;
  const screenHeightRef = useRef(screenHeight);
  screenHeightRef.current = screenHeight;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4,
      onPanResponderMove: (_e, g) => {
        // Dragging up grows the sheet, so the delta is inverted.
        const nextHeight = heightValue.current - g.dy;
        const clamped = Math.max(
          screenHeightRef.current * SNAP_POINTS.collapsed,
          Math.min(nextHeight, maxHeightRef.current),
        );
        height.setValue(clamped);
      },
      onPanResponderRelease: (_e, g) => {
        const current = heightValue.current;
        const from = nearest(current, screenHeightRef.current, maxHeightRef.current);
        if (Math.abs(g.dy) < MIN_DRAG_TO_SNAP) {
          settleRef.current(from);
          return;
        }
        settleRef.current(g.dy < 0 ? next(from, "up") : next(from, "down"));
      },
    }),
  ).current;

  return (
    <Animated.View style={[styles.sheet, { height }]}>
      {/*
        The grabber and the title block are one drag surface. Attaching the
        handlers to the 28pt handle alone left almost nothing to aim at, which
        is what made the sheet impossible to pull back down once raised.
      */}
      <View {...panResponder.panHandlers} accessibilityRole="adjustable">
        <View style={styles.handleArea}>
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
      </View>
      <View style={[styles.body, position === "collapsed" && styles.bodyHidden]}>{children}</View>
    </Animated.View>
  );
}

export function nearest(height: number, screenHeight: number, maxHeight: number): SheetPosition {
  const entries = Object.entries(SNAP_POINTS) as [SheetPosition, number][];
  const heightOf = (ratio: number) => Math.min(screenHeight * ratio, maxHeight);
  return entries.reduce(
    (best, [key, ratio]) =>
      Math.abs(heightOf(ratio) - height) < Math.abs(heightOf(SNAP_POINTS[best]) - height)
        ? key
        : best,
    "half" as SheetPosition,
  );
}

export function next(from: SheetPosition, direction: "up" | "down"): SheetPosition {
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
