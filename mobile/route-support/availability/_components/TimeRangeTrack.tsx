import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";

import { FONTS, RADIUS_DENSE, SPACE, TYPO, useReducedMotion, useTheme } from "@/theme";

import { MINUTES_PER_DAY, SNAP_MINUTES, formatMinute, snapMinute } from "../utils";

/**
 * A twenty-four hour track with two draggable handles.
 *
 * Built on `Animated` and `PanResponder`, which is what every other gesture in
 * this app uses — the same construction as the HQ map sheet. The responder is
 * created once and reads live values through refs, because recreating it on
 * every render drops the gesture mid-drag.
 *
 * Minutes are the unit throughout. Pixels only exist between a touch landing
 * and the minute it snaps to, so a track of any width behaves identically.
 */

const HANDLE_SIZE = 28;
const TRACK_HEIGHT = 56;
const HOUR_TICKS = [0, 6, 12, 18, 24];

export interface TimeRangeTrackProps {
  readonly startMinute: number;
  readonly endMinute: number;
  readonly onChange: (startMinute: number, endMinute: number) => void;
  /** Fires when a drag settles, so the caller can play feedback once. */
  readonly onSettle?: () => void;
  readonly disabled?: boolean;
  readonly accessibilityLabel?: string;
}

type Grip = "start" | "end" | "span" | null;

export function TimeRangeTrack({
  accessibilityLabel = "Time range",
  disabled = false,
  endMinute,
  onChange,
  onSettle,
  startMinute,
}: TimeRangeTrackProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const [grip, setGrip] = useState<Grip>(null);

  // Live values the one-time responder reads. State alone would be captured at
  // creation and freeze the drag at whatever the range was when it mounted.
  const widthRef = useRef(0);
  const startRef = useRef(startMinute);
  const endRef = useRef(endMinute);
  const gripRef = useRef<Grip>(null);
  const dragOriginRef = useRef({ end: endMinute, start: startMinute });
  const onChangeRef = useRef(onChange);
  const onSettleRef = useRef(onSettle);
  const disabledRef = useRef(disabled);

  useEffect(() => { startRef.current = startMinute; }, [startMinute]);
  useEffect(() => { endRef.current = endMinute; }, [endMinute]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { onSettleRef.current = onSettle; }, [onSettle]);
  useEffect(() => { disabledRef.current = disabled; }, [disabled]);

  const emphasis = useRef(new Animated.Value(0)).current;

  const setEmphasis = useCallback((active: boolean) => {
    if (reduceMotion) {
      emphasis.setValue(active ? 1 : 0);
      return;
    }
    Animated.spring(emphasis, {
      damping: 22,
      stiffness: 240,
      toValue: active ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [emphasis, reduceMotion]);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current,
      onMoveShouldSetPanResponder: (_event, gesture) => (
        !disabledRef.current && Math.abs(gesture.dx) > 2
      ),
      onPanResponderGrant: (event) => {
        const width = widthRef.current;
        if (width <= 0) {
          return;
        }
        const touched = snapMinute((event.nativeEvent.locationX / width) * MINUTES_PER_DAY);
        const start = startRef.current;
        const end = endRef.current;
        // Whichever edge the touch is nearest takes the drag, unless the touch
        // landed comfortably inside the span, in which case the whole span
        // moves. Without this a driver can only ever resize, never shift.
        const startDistance = Math.abs(touched - start);
        const endDistance = Math.abs(touched - end);
        const insideSpan = touched > start && touched < end;
        const edgeSlack = Math.max(SNAP_MINUTES * 2, MINUTES_PER_DAY * 0.04);
        const next: Grip = insideSpan && startDistance > edgeSlack && endDistance > edgeSlack
          ? "span"
          : startDistance <= endDistance ? "start" : "end";

        gripRef.current = next;
        dragOriginRef.current = { end, start };
        setGrip(next);
      },
      onPanResponderMove: (event, gesture) => {
        const width = widthRef.current;
        const current = gripRef.current;
        if (width <= 0 || !current) {
          return;
        }

        if (current === "span") {
          const origin = dragOriginRef.current;
          const span = origin.end - origin.start;
          const delta = snapMinute(
            Math.abs((gesture.dx / width) * MINUTES_PER_DAY),
          ) * Math.sign(gesture.dx);
          const nextStart = Math.max(0, Math.min(MINUTES_PER_DAY - span, origin.start + delta));
          startRef.current = nextStart;
          endRef.current = nextStart + span;
          onChangeRef.current(nextStart, nextStart + span);
          return;
        }

        const touched = snapMinute((event.nativeEvent.locationX / width) * MINUTES_PER_DAY);
        if (current === "start") {
          // The handles may meet but never cross; a range that inverts would
          // read as a negative block.
          const nextStart = Math.min(touched, endRef.current - SNAP_MINUTES);
          startRef.current = Math.max(0, nextStart);
          onChangeRef.current(startRef.current, endRef.current);
          return;
        }

        const nextEnd = Math.max(touched, startRef.current + SNAP_MINUTES);
        endRef.current = Math.min(MINUTES_PER_DAY, nextEnd);
        onChangeRef.current(startRef.current, endRef.current);
      },
      onPanResponderRelease: () => {
        gripRef.current = null;
        setGrip(null);
        onSettleRef.current?.();
      },
      onPanResponderTerminate: () => {
        gripRef.current = null;
        setGrip(null);
      },
    }),
  ).current;

  useEffect(() => { setEmphasis(grip !== null); }, [grip, setEmphasis]);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    widthRef.current = width;
    setTrackWidth(width);
  }, []);

  const geometry = useMemo(() => {
    if (trackWidth <= 0) {
      return { left: 0, width: 0 };
    }
    const left = (startMinute / MINUTES_PER_DAY) * trackWidth;
    const right = (endMinute / MINUTES_PER_DAY) * trackWidth;
    return { left, width: Math.max(2, right - left) };
  }, [endMinute, startMinute, trackWidth]);

  const scale = emphasis.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  return (
    <View style={styles.wrapper}>
      <View style={styles.readoutRow}>
        <Text style={[styles.readout, { color: theme.text }]}>{formatMinute(startMinute)}</Text>
        <Text style={[styles.readoutDivider, { color: theme.textMuted }]}>to</Text>
        <Text style={[styles.readout, { color: theme.text }]}>{formatMinute(endMinute)}</Text>
      </View>

      <View
        accessibilityHint="Drag either end to change the time, or drag the middle to move the whole span."
        accessibilityLabel={`${accessibilityLabel}, ${formatMinute(startMinute)} to ${formatMinute(endMinute)}`}
        accessibilityRole="adjustable"
        accessibilityState={{ disabled }}
        accessibilityValue={{ max: MINUTES_PER_DAY, min: 0, now: startMinute }}
        onLayout={onLayout}
        style={[
          styles.track,
          { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
          disabled && styles.trackDisabled,
        ]}
        {...responder.panHandlers}
      >
        {HOUR_TICKS.map((hour) => (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no"
            key={hour}
            style={[
              styles.tick,
              { backgroundColor: theme.border, left: `${(hour / 24) * 100}%` },
            ]}
          />
        ))}

        <Animated.View
          style={[
            styles.span,
            {
              backgroundColor: disabled ? theme.tint.primary.soft : theme.tint.primary.medium,
              borderColor: theme.primaryLight,
              left: geometry.left,
              transform: [{ scaleY: scale }],
              width: geometry.width,
            },
          ]}
        />

        <Animated.View
          style={[
            styles.handle,
            {
              backgroundColor: theme.primaryLight,
              left: geometry.left - HANDLE_SIZE / 2,
              transform: [{ scale: grip === "start" ? scale : 1 }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.handle,
            {
              backgroundColor: theme.primaryLight,
              left: geometry.left + geometry.width - HANDLE_SIZE / 2,
              transform: [{ scale: grip === "end" ? scale : 1 }],
            },
          ]}
        />
      </View>

      <View style={styles.scaleRow}>
        {HOUR_TICKS.map((hour) => (
          <Text key={hour} style={[styles.scaleLabel, { color: theme.textMuted }]}>
            {hour === 24 ? "12a" : hour === 0 ? "12a" : hour === 12 ? "12p" : hour > 12 ? `${hour - 12}p` : `${hour}a`}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  handle: {
    borderRadius: HANDLE_SIZE / 2,
    height: HANDLE_SIZE,
    position: "absolute",
    top: (TRACK_HEIGHT - HANDLE_SIZE) / 2,
    width: HANDLE_SIZE,
  },
  readout: { ...TYPO.cardTitle, fontFamily: FONTS.bold },
  readoutDivider: { ...TYPO.caption },
  readoutRow: { alignItems: "center", flexDirection: "row", gap: SPACE.sm, justifyContent: "center" },
  scaleLabel: { ...TYPO.subtitle, fontSize: 10 },
  scaleRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 2 },
  span: {
    borderRadius: RADIUS_DENSE.md,
    borderWidth: 1,
    bottom: 8,
    position: "absolute",
    top: 8,
  },
  tick: { bottom: 0, position: "absolute", top: 0, width: 1 },
  track: {
    borderRadius: RADIUS_DENSE.lg,
    borderWidth: 1,
    height: TRACK_HEIGHT,
    justifyContent: "center",
    overflow: "hidden",
  },
  trackDisabled: { opacity: 0.5 },
  wrapper: { gap: SPACE.sm },
});
