import { Feather } from "@expo/vector-icons";
import { Image, Pressable, Text, View } from "react-native";

import { DriverAvatar } from "@/components/operations";
import type { Customer, Driver } from "@/domain/types";

import { styles } from "../styles";
import {
  EQUIPMENT_IMAGES,
  formatTime,
  getAssignedDrivers,
  getDuration,
  getLoadColor,
  orderedStops,
  scheduledEnd,
  scheduledStart,
} from "../utils";
import type { LayoutBlock } from "./dayTimelineLayout";
import { SegmentBar } from "./SegmentBar";

/**
 * One positioned load on the day grid. Ported from the Appliance Diagnostic
 * Systems `DayTimeline` at 480991b7eb0036e4e85c37d3784b2de2ca97d10d.
 */

interface DayTimelineBlockProps {
  readonly block: LayoutBlock;
  readonly onPress: (shipmentId: string) => void;
  readonly driverColors: Record<string, string>;
  readonly drivers: readonly Driver[];
  readonly customersById: Readonly<Record<string, Customer>>;
}

export function DayTimelineBlock({
  block: { shipment, top, height, left, width },
  onPress,
  driverColors,
  drivers,
  customersById,
}: DayTimelineBlockProps) {
  const color = getLoadColor(shipment, driverColors);
  const assignedDrivers = getAssignedDrivers(shipment, drivers);
  const stops = orderedStops(shipment);
  const pickup = stops.find((stop) => stop.type === "pickup") ?? stops[0];
  const startIso = scheduledStart(shipment);
  const endIso = scheduledEnd(shipment);
  const equipmentImage = EQUIPMENT_IMAGES[shipment.equipmentType];
  const customer = customersById[shipment.customerId];

  return (
    <Pressable
      accessibilityLabel={`Load ${shipment.loadNumber}`}
      accessibilityRole="button"
      onPress={() => onPress(shipment.id)}
      style={[
        styles.dayViewBlock,
        {
          top,
          height,
          left: `${left * 100}%` as `${number}%`,
          width: `${width * 100}%` as `${number}%`,
          backgroundColor: `${color}CC`,
          paddingLeft: 7,
        },
      ]}
    >
      <View style={{ position: "absolute", left: 0, top: 4, bottom: 4, width: 3 }}>
        <SegmentBar
          borderRadius={2}
          color={color}
          segmentIndex={0}
          totalSegments={stops.length}
          width={3}
        />
      </View>

      {stops.length > 1 ? (
        <Text numberOfLines={1} style={styles.dayViewVisitLabel}>
          {`${stops.length} stops`}
        </Text>
      ) : null}
      <Text numberOfLines={1} style={styles.dayViewBlockTitle}>
        {customer?.companyName ?? shipment.loadNumber}
      </Text>
      {pickup ? (
        <Text numberOfLines={1} style={styles.dayViewBlockAddr}>
          {[pickup.facilityName, pickup.address.city].filter(Boolean).join(", ")}
        </Text>
      ) : null}
      {startIso && endIso ? (
        <Text style={styles.dayViewBlockDesc}>
          {formatTime(startIso)} · {getDuration(startIso, endIso)}
        </Text>
      ) : null}

      {assignedDrivers.length > 0 ? (
        <View style={styles.dayBlockTechRow}>
          {assignedDrivers.slice(0, 2).map((driver) => (
            <View key={driver.id} style={styles.dayBlockTechChip}>
              <DriverAvatar driver={driver} ring={false} size={12} />
              <Text style={styles.dayBlockTechName}>{driver.firstName}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {height > 40 ? (
        <View style={styles.dayBlockApplianceStack}>
          {equipmentImage ? (
            <Image
              accessibilityIgnoresInvertColors
              resizeMode="contain"
              source={equipmentImage}
              style={styles.dayBlockApplianceImage}
            />
          ) : (
            <View style={styles.dayBlockBrandFallback}>
              <Feather color="rgba(255,255,255,0.7)" name="truck" size={8} />
            </View>
          )}
        </View>
      ) : null}
    </Pressable>
  );
}
