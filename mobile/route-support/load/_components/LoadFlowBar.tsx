import { Feather } from "@expo/vector-icons";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

import type { ShipmentStatus } from "@/domain/types";
import { FONTS, RADIUS_LEGACY as RADIUS, SPACING, THEME, useReducedMotion } from "@/theme";

/**
 * Ported from the Appliance Diagnostic Systems `JobFlowBar` at
 * 480991b7eb0036e4e85c37d3784b2de2ca97d10d — the same horizontal step rail
 * with pulsing active node, connectors that fill as steps complete, edge
 * fades, auto-scroll to the active step, tap-to-focus with a transient
 * caption, and a completion banner.
 *
 * The appliance workflow steps become the freight lifecycle, which is
 * linear, so a step's state is derived from the shipment status rather than
 * from a separate workflow record.
 */

const STEPS = [
  { key: "tendered", label: "Tender", icon: "inbox" },
  { key: "accepted", label: "Accepted", icon: "check-circle" },
  { key: "dispatched", label: "Dispatch", icon: "send" },
  { key: "at_pickup", label: "Pickup", icon: "map-pin" },
  { key: "loaded", label: "Loaded", icon: "package" },
  { key: "in_transit", label: "Transit", icon: "truck" },
  { key: "at_delivery", label: "Delivery", icon: "flag" },
  { key: "delivered", label: "Delivered", icon: "check-square" },
] as const;

export type LoadStepKey = (typeof STEPS)[number]["key"];
export { STEPS as LOAD_FLOW_STEPS };

const NODE_WIDTH = 52;
const CONNECTOR_WIDTH = 8;
const STEP_UNIT = NODE_WIDTH + CONNECTOR_WIDTH;
const H_PAD = 16;

const STATE_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  upcoming: { bg: `${THEME.textSecondary}15`, fg: THEME.textSecondary, border: `${THEME.textSecondary}30` },
  active: { bg: `${THEME.primary}25`, fg: THEME.primary, border: THEME.primary },
  completed: { bg: `${THEME.success}20`, fg: THEME.success, border: THEME.success },
  blocked: { bg: `${THEME.warning}15`, fg: THEME.warning, border: THEME.warning },
  skipped: { bg: `${THEME.textMuted}08`, fg: THEME.textMuted, border: `${THEME.textMuted}20` },
};

/**
 * Ported from the reference's `PulseRing`. Reduce Motion drops the loop and
 * leaves the ring at rest, because it is decorative emphasis, not information.
 */
function PulseRing({ color, size = 26 }: { readonly color: string; readonly size?: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      anim.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [anim, reduceMotion]);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const opacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 0.15, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: color,
        opacity,
        transform: [{ scale }],
      }}
    />
  );
}

/**
 * The freight lifecycle is linear, so every step before the current status is
 * complete and every step after it is upcoming. A cancelled or declined load
 * blocks the remaining steps rather than pretending they are still coming.
 */
export function loadStepStates(status: ShipmentStatus): Record<string, string> {
  const order = STEPS.map((step) => step.key) as readonly string[];
  const terminal = status === "cancelled" || status === "declined";
  const currentIndex = order.indexOf(status);
  const states: Record<string, string> = {};

  for (const [index, key] of order.entries()) {
    if (terminal) {
      states[key] = index === 0 ? "completed" : "blocked";
      continue;
    }
    if (status === "exception") {
      states[key] = "blocked";
      continue;
    }
    if (currentIndex < 0) {
      states[key] = "upcoming";
      continue;
    }
    states[key] = index < currentIndex ? "completed" : index === currentIndex ? "active" : "upcoming";
  }
  if (status === "delivered") {
    for (const key of order) states[key] = "completed";
  }
  return states;
}

interface LoadFlowBarProps {
  readonly status: ShipmentStatus;
  readonly onStepTap?: (stepKey: LoadStepKey) => void;
}

export function LoadFlowBar({ status, onStepTap }: LoadFlowBarProps) {
  const scrollRef = useRef<ScrollView>(null);
  const { width: screenWidth } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(screenWidth);
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);
  const fadeLeftAnim = useRef(new Animated.Value(0)).current;
  const fadeRightAnim = useRef(new Animated.Value(1)).current;

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

  return (
    <Animated.View onLayout={handleLayout} style={st.container}>
      <View style={st.scrollWrap}>
        <Animated.View
          pointerEvents="none"
          style={[st.fadeEdge, st.fadeLeft, { opacity: fadeLeftAnim }]}
        />
        <Animated.View
          pointerEvents="none"
          style={[st.fadeEdge, st.fadeRight, { opacity: fadeRightAnim }]}
        />

        <ScrollView
          contentContainerStyle={st.scrollContent}
          decelerationRate="fast"
          horizontal
          onScroll={handleScroll}
          ref={scrollRef}
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}
        >
          {STEPS.map((step, idx) => {
            const state = states[step.key] || "upcoming";
            const colors = STATE_COLORS[state] || STATE_COLORS.upcoming;
            const isActive = state === "active";
            const isFocused = focusedIdx === idx;

            return (
              <Fragment key={step.key}>
                {idx > 0 ? (
                  <View style={st.connectorWrap}>
                    <View
                      style={[
                        st.connector,
                        {
                          backgroundColor:
                            states[STEPS[idx - 1].key] === "completed"
                              ? THEME.success
                              : `${THEME.textMuted}30`,
                        },
                      ]}
                    />
                  </View>
                ) : null}
                <Pressable
                  accessibilityLabel={`${step.label}: ${state}`}
                  accessibilityRole="button"
                  onPress={() => {
                    onStepTap?.(step.key);
                    setFocusedIdx(idx);
                    scrollBarToStep(idx);
                    setTimeout(() => setFocusedIdx(null), 2000);
                  }}
                  style={({ pressed }) => [
                    st.stepNode,
                    isActive && { borderColor: `${THEME.primary}30` },
                    isFocused && { borderColor: colors.fg, backgroundColor: `${colors.fg}10` },
                    pressed && { opacity: 0.6, transform: [{ scale: 0.92 }] },
                  ]}
                >
                  <View style={[st.stepCircle, { backgroundColor: colors.bg }]}>
                    {isActive ? <PulseRing color={colors.fg} size={26} /> : null}
                    {state === "completed" ? (
                      <Feather color={colors.fg} name="check" size={12} />
                    ) : state === "blocked" ? (
                      <View>
                        <Feather color={colors.fg} name={step.icon} size={12} />
                        <View style={st.blockBadge}>
                          <Feather color="#fff" name="lock" size={6} />
                        </View>
                      </View>
                    ) : state === "skipped" ? (
                      <Feather color={colors.fg} name="minus" size={12} />
                    ) : (
                      <Feather color={colors.fg} name={step.icon} size={12} />
                    )}
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[
                      st.stepLabel,
                      { color: colors.fg },
                      state === "skipped" && st.skippedLabel,
                      (isActive || isFocused) && st.activeLabel,
                    ]}
                  >
                    {step.label}
                  </Text>
                </Pressable>
              </Fragment>
            );
          })}
        </ScrollView>
      </View>

      {focusedIdx !== null ? (
        <View style={st.focusedInfo}>
          <Text
            style={[
              st.focusedInfoText,
              {
                color: (STATE_COLORS[states[STEPS[focusedIdx].key]] || STATE_COLORS.upcoming).fg,
              },
            ]}
          >
            {STEPS[focusedIdx].label}:{" "}
            {(states[STEPS[focusedIdx].key] || "upcoming").replace(/^\w/, (c) => c.toUpperCase())}
          </Text>
        </View>
      ) : null}

      {isAllComplete ? (
        <View style={st.completeBanner}>
          <Feather color={THEME.success} name="check-circle" size={14} />
          <Text style={st.completeBannerText}>Load Complete</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

const st = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: "transparent",
    paddingBottom: 0,
  },
  scrollWrap: {
    position: "relative",
    overflow: "hidden",
  },
  fadeEdge: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 24,
    zIndex: 10,
  },
  fadeLeft: {
    left: 0,
    backgroundColor: "transparent",
    borderRightWidth: 0,
  },
  fadeRight: {
    right: 0,
    backgroundColor: "transparent",
    borderLeftWidth: 0,
  },
  scrollContent: {
    paddingHorizontal: H_PAD,
    paddingVertical: 6,
    alignItems: "center",
  },
  connectorWrap: {
    justifyContent: "center",
    alignItems: "center",
    width: CONNECTOR_WIDTH,
    marginTop: -8,
  },
  connector: {
    height: 2,
    width: CONNECTOR_WIDTH,
    borderRadius: 1,
  },
  stepNode: {
    alignItems: "center",
    gap: 2,
    paddingVertical: 2,
    paddingHorizontal: 2,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: "transparent",
    width: NODE_WIDTH,
  },
  scrollActiveNode: {
    borderColor: `${THEME.primary}40`,
    backgroundColor: `${THEME.primary}08`,
  },
  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  blockBadge: {
    position: "absolute",
    bottom: -2,
    right: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: THEME.warning,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLabel: {
    fontFamily: FONTS.medium,
    fontSize: 9,
    textAlign: "center",
  },
  activeLabel: {
    fontFamily: FONTS.bold,
    fontSize: 9,
  },
  skippedLabel: {
    textDecorationLine: "line-through",
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 3,
    paddingVertical: 3,
  },
  dot: {
    height: 3,
    borderRadius: 1.5,
  },
  focusedInfo: {
    alignItems: "center",
    paddingVertical: 3,
  },
  focusedInfoText: {
    fontFamily: FONTS.semibold,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  completeBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: SPACING.xs,
    backgroundColor: `${THEME.success}10`,
  },
  completeBannerText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: THEME.success,
  },
});

export default LoadFlowBar;
