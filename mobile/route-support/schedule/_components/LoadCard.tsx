import { Feather } from "@expo/vector-icons";
import { Image, Pressable, Text, View } from "react-native";

import { DriverAvatar } from "@/components/operations";
import type { Customer, Driver, Shipment } from "@/domain/types";
import { THEME } from "@/theme";

import { styles } from "../styles";
import {
  EQUIPMENT_IMAGES,
  formatTime,
  getAssignedDrivers,
  getDuration,
  getLoadColor,
  isLoadPast,
  orderedStops,
  scheduledEnd,
  scheduledStart,
  driverFullName,
} from "../utils";
import { SegmentBar } from "./SegmentBar";

/**
 * Ported from the Appliance Diagnostic Systems `JobCard` at
 * 480991b7eb0036e4e85c37d3784b2de2ca97d10d, using the same styles, the same
 * time/segment/avatar composition, and the same chevron and artwork slots.
 * A job becomes a load, a technician becomes a driver, and the appliance
 * artwork slot carries equipment type instead.
 */

const STATUS_LABELS: Record<Shipment["status"], string> = {
  tendered: "Tendered",
  accepted: "Accepted",
  declined: "Declined",
  dispatched: "Dispatched",
  at_pickup: "At pickup",
  loaded: "Loaded",
  in_transit: "In transit",
  at_delivery: "At delivery",
  delivered: "Delivered",
  exception: "Exception",
  cancelled: "Cancelled",
};

interface LoadCardProps {
  readonly shipment: Shipment;
  readonly driverColors: Record<string, string>;
  readonly drivers: readonly Driver[];
  readonly customer?: Customer;
  readonly onPress: () => void;
  readonly onCustomerPress: () => void;
  readonly hasException?: boolean;
}

export function LoadCard({
  shipment,
  driverColors,
  drivers,
  customer,
  onPress,
  onCustomerPress,
  hasException,
}: LoadCardProps) {
  const color = getLoadColor(shipment, driverColors);
  const isPast = isLoadPast(shipment);
  const assigned = getAssignedDrivers(shipment, drivers);
  const stops = orderedStops(shipment);
  const start = scheduledStart(shipment);
  const end = scheduledEnd(shipment);
  const equipmentImage = EQUIPMENT_IMAGES[shipment.equipmentType];
  const pickup = stops.find((stop) => stop.type === "pickup") ?? stops[0];

  return (
    <Pressable
      accessibilityHint="Opens the full load workflow"
      accessibilityLabel={`Load ${shipment.loadNumber}`}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.appointmentCard, isPast && styles.pastCard]}
    >
      {hasException ? (
        <View style={styles.partOrderBadge}>
          <Feather color="#FFF" name="alert-triangle" size={10} />
        </View>
      ) : null}

      <View style={styles.appointmentTimeCol}>
        <Text style={[styles.appointmentTime, isPast && styles.pastText]}>
          {start ? formatTime(start) : "Anytime"}
        </Text>
        {start && end ? (
          <Text style={styles.appointmentDuration}>{getDuration(start, end)}</Text>
        ) : null}
      </View>

      <SegmentBar
        borderRadius={2}
        color={color}
        segmentIndex={0}
        style={styles.appointmentColorBar}
        totalSegments={stops.length}
        width={3}
      />

      <View style={styles.appointmentDetails}>
        {stops.length > 1 ? (
          <Text style={[styles.visitLabel, isPast && styles.pastText]}>
            {`${stops.length} stops`}
          </Text>
        ) : null}
        <Text style={[styles.appointmentTitle, isPast && styles.pastText]}>
          {STATUS_LABELS[shipment.status]}
        </Text>
        <Pressable
          accessibilityLabel={`Customer for load ${shipment.loadNumber}`}
          accessibilityRole="button"
          onPress={onCustomerPress}
        >
          <Text
            numberOfLines={1}
            style={[styles.appointmentCustomer, isPast && styles.pastText]}
          >
            {customer?.companyName ?? shipment.loadNumber}
          </Text>
        </Pressable>
        {pickup ? (
          <Text numberOfLines={1} style={styles.appointmentAddress}>
            {[pickup.facilityName, pickup.address.city].filter(Boolean).join(", ")}
          </Text>
        ) : null}

        {assigned.length > 0 ? (
          <View style={styles.techRow}>
            <View style={styles.techAvatarStack}>
              {assigned.slice(0, 3).map((driver, index) => (
                <View
                  key={driver.id}
                  style={[styles.techAvatarWrap, { marginLeft: index > 0 ? -6 : 0 }]}
                >
                  <DriverAvatar driver={driver} past={isPast} size={20} />
                </View>
              ))}
            </View>
            <Text numberOfLines={1} style={[styles.techName, isPast && styles.pastText]}>
              {assigned.map(driverFullName).join(", ")}
            </Text>
          </View>
        ) : null}
      </View>

      <Feather
        color={THEME.textMuted}
        name="chevron-right"
        size={16}
        style={styles.appointmentChevron}
      />

      <View style={styles.cardApplianceStack}>
        {equipmentImage ? (
          <Image
            accessibilityIgnoresInvertColors
            resizeMode="contain"
            source={equipmentImage}
            style={styles.cardApplianceImage}
          />
        ) : (
          <View style={styles.cardBrandFallback}>
            <Feather color={THEME.textMuted} name="truck" size={10} />
          </View>
        )}
      </View>
    </Pressable>
  );
}
