import { THEME } from "@/theme";
import { Feather } from "@expo/vector-icons";
import { Fragment } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  Text,
  View
} from "react-native";
import { LoadFlowBarProps, PulseRing, STATE_COLORS, STEPS } from "./loadFlowParts";
import { st } from "./loadFlowStyles";

import { useLoadFlowBar } from "./useLoadFlowBar";

export { STEPS as LOAD_FLOW_STEPS };
export default LoadFlowBar;
export { loadStepStates, type LoadStepKey } from "./loadFlowParts";
export function LoadFlowBar({ status, onStepTap }: LoadFlowBarProps) {
  const { scrollRef, focusedIdx, setFocusedIdx, fadeLeftAnim, fadeRightAnim, states, isAllComplete, scrollBarToStep, handleScroll, handleLayout } = useLoadFlowBar({ status, onStepTap });
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
