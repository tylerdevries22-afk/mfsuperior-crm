import { MINUTES_PER_DAY, SNAP_MINUTES, snapMinute } from "@/route-support/availability/utils";
import { useReducedMotion, useTheme } from "@/theme";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  type LayoutChangeEvent
} from "react-native";
import { Grip, TimeRangeTrackProps } from "./timeRangeParts";

export function useTimeRangeTrack({
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

  const [emphasis] = useState(() => new Animated.Value(0));

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

  // PanResponder stores these handlers; it never calls them during creation.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() => PanResponder.create({
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
  }));

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
  return { theme, grip, responder, onLayout, geometry, scale };
}
