import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";

import { AnimatedPressable, StatusBadge } from "@/components/ui";
import type { Customer, Shipment } from "@/domain/types";
import { formatTime, orderedStops, scheduledEnd, scheduledStart } from "@/route-support/schedule/utils";
import { FONTS, THEME } from "@/theme";

import { s } from "../homeStyles";

/**
 * Ported from the Appliance Diagnostic Systems "next job" card at
 * 480991b7eb0036e4e85c37d3784b2de2ca97d10d — the same gradient shell, time
 * badge, status pill, customer line, meta row, and trailing action. The
 * reference reuses it for both "MY NEXT JOB" and the "TODAY'S JOBS" rail, so
 * it is one component here too.
 */

function arrivalWindow(shipment: Shipment): string {
  const start = scheduledStart(shipment);
  const end = scheduledEnd(shipment);
  if (!start) return "Unscheduled";
  return end ? `${formatTime(start)} – ${formatTime(end)}` : formatTime(start);
}

export function LoadHeroCard({
  shipment,
  customer,
  onPress,
  style,
}: {
  readonly shipment: Shipment;
  readonly customer?: Customer;
  readonly onPress: () => void;
  readonly style?: StyleProp<ViewStyle>;
}) {
  const stops = orderedStops(shipment);
  const pickup = stops.find((stop) => stop.type === "pickup") ?? stops[0];
  const delivery = stops.findLast?.((stop) => stop.type === "delivery") ?? stops[stops.length - 1];

  return (
    <AnimatedPressable
      accessibilityLabel={`Load ${shipment.loadNumber}`}
      accessibilityRole="button"
      haptic="selection"
      onPress={onPress}
      style={[s.nextJobCard, style]}
    >
      <LinearGradient
        colors={[`${THEME.primary}12`, `${THEME.primary}04`]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={s.nextJobGradient}
      >
        <View style={s.nextJobTop}>
          <View style={s.nextJobTimeBadge}>
            <Feather color={THEME.primary} name="clock" size={12} />
            <Text style={s.nextJobTimeText}>{arrivalWindow(shipment)}</Text>
          </View>
          <StatusBadge showDot={false} size="sm" status={shipment.status} />
        </View>

        <Text numberOfLines={1} style={s.nextJobCustomer}>
          {customer?.companyName ?? shipment.loadNumber}
        </Text>

        <Text
          style={{ fontFamily: FONTS.medium, fontSize: 12, color: THEME.textMuted, marginBottom: 4 }}
        >
          {shipment.loadNumber} · {shipment.palletCount} pallets ·{" "}
          {shipment.weightPounds.toLocaleString()} lb
        </Text>

        {pickup && delivery ? (
          <View style={s.nextJobMeta}>
            <Feather color={THEME.textMuted} name="map-pin" size={12} />
            <Text numberOfLines={1} style={s.nextJobAddress}>
              {pickup.address.city} → {delivery.address.city}
            </Text>
          </View>
        ) : null}

        <View style={s.nextJobActions}>
          <View style={{ flex: 1 }} />
          <AnimatedPressable haptic="light" onPress={onPress} style={s.nextJobBtn}>
            <Feather color={THEME.primary} name="arrow-right" size={14} />
            <Text style={s.nextJobBtnText}>View Details</Text>
          </AnimatedPressable>
        </View>
      </LinearGradient>
    </AnimatedPressable>
  );
}
