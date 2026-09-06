import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  ScrollView,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent
} from "react-native";
import { CONNECTOR_WIDTH, H_PAD, LoadFlowBarProps, loadStepStates, NODE_WIDTH, STEP_UNIT, STEPS } from "./loadFlowParts";

export function useLoadFlowBar({ status }: LoadFlowBarProps) {

  const scrollRef = useRef<ScrollView>(null);

  const { width: screenWidth } = useWindowDimensions();

  const [containerWidth, setContainerWidth] = useState(screenWidth);

  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);

  const [fadeLeftAnim] = useState(() => new Animated.Value(0));

  const [fadeRightAnim] = useState(() => new Animated.Value(1));

  const states = useMemo(() => loadStepStates(status), [status]);

  const activeIndex = useMemo(() => {
    const idx = STEPS.findIndex((step) => states[step.key] === "active");
    if (idx >= 0) return idx;
    return STEPS.findIndex(
      (step) => states[step.key] !== "completed" && states[step.key] !== "skipped",
    );
  }, [states]);

  const isAllComplete = STEPS.every(
    (step) => states[step.key] === "completed" || states[step.key] === "skipped",
  );

  const totalContentWidth =
    STEPS.length * NODE_WIDTH + (STEPS.length - 1) * CONNECTOR_WIDTH + H_PAD * 2;

  const maxScroll = Math.max(0, totalContentWidth - containerWidth);

  useEffect(() => {
    if (activeIndex < 0) return undefined;
    const timer = setTimeout(() => {
      const targetX = H_PAD + activeIndex * STEP_UNIT + NODE_WIDTH / 2 - containerWidth / 2;
      scrollRef.current?.scrollTo({
        x: Math.max(0, Math.min(targetX, maxScroll)),
        animated: true,
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [activeIndex, containerWidth, maxScroll]);

  const scrollBarToStep = useCallback(
    (idx: number) => {
      if (idx < 0) return;
      const targetX = H_PAD + idx * STEP_UNIT + NODE_WIDTH / 2 - containerWidth / 2;
      scrollRef.current?.scrollTo({
        x: Math.max(0, Math.min(targetX, maxScroll)),
        animated: true,
      });
    },
    [containerWidth, maxScroll],
  );

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      Animated.timing(fadeLeftAnim, {
        toValue: x > 8 ? 1 : 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
      Animated.timing(fadeRightAnim, {
        toValue: x < maxScroll - 8 ? 1 : 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    },
    [fadeLeftAnim, fadeRightAnim, maxScroll],
  );

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  }, []);
  return { scrollRef, focusedIdx, setFocusedIdx, fadeLeftAnim, fadeRightAnim, states, isAllComplete, scrollBarToStep, handleScroll, handleLayout };
}
