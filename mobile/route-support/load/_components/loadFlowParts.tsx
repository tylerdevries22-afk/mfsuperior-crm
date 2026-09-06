import type { ShipmentStatus } from "@/domain/types";
import { THEME, useReducedMotion } from "@/theme";
import { useEffect, useState } from "react";
import {
  Animated,
  Easing
} from "react-native";

export const STEPS = [
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

export const NODE_WIDTH = 52;

export const CONNECTOR_WIDTH = 8;

export const STEP_UNIT = NODE_WIDTH + CONNECTOR_WIDTH;

export const H_PAD = 16;

export const STATE_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  upcoming: { bg: `${THEME.textSecondary}15`, fg: THEME.textSecondary, border: `${THEME.textSecondary}30` },
  active: { bg: `${THEME.primary}25`, fg: THEME.primary, border: THEME.primary },
  completed: { bg: `${THEME.success}20`, fg: THEME.success, border: THEME.success },
  blocked: { bg: `${THEME.warning}15`, fg: THEME.warning, border: THEME.warning },
  skipped: { bg: `${THEME.textMuted}08`, fg: THEME.textMuted, border: `${THEME.textMuted}20` },
};

export function PulseRing({ color, size = 26 }: { readonly color: string; readonly size?: number }) {
  const [anim] = useState(() => new Animated.Value(0));
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

export interface LoadFlowBarProps {
  readonly status: ShipmentStatus;
  readonly onStepTap?: (stepKey: LoadStepKey) => void;
}
