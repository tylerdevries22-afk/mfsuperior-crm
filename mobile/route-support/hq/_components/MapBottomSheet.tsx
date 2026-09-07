import { RADIUS, useReducedMotion } from "@/theme";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  PanResponder,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CORNER_RADIUS, DRAG_HANDLE_HEIGHT, MIN_DRAG_TO_SNAP, MIN_TOP_GAP, SNAP_POINTS, SPRING, SheetPosition, nearest, next, styles } from "./mapSheetParts";

export { CORNER_RADIUS, DRAG_HANDLE_HEIGHT, RADIUS, SNAP_POINTS };
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
  const [height] = useState(() => new Animated.Value(heightFor(initialPosition)));
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
  useEffect(() => { settleRef.current = settle; }, [settle]);
  useEffect(() => {
    if (!controlledPosition || controlledPosition === position) return;
    settleRef.current(controlledPosition);
  }, [controlledPosition, position]);

  // PanResponder is created once, so live values reach it through refs.
  const maxHeightRef = useRef(maxHeight);
  useEffect(() => { maxHeightRef.current = maxHeight; }, [maxHeight]);
  const screenHeightRef = useRef(screenHeight);
  useEffect(() => { screenHeightRef.current = screenHeight; }, [screenHeight]);

  // PanResponder stores these handlers; it never calls them during creation.
  // eslint-disable-next-line react-hooks/refs
  const [panResponder] = useState(() => PanResponder.create({
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
  }));

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

export { nearest, next, type SheetPosition } from "./mapSheetParts";
