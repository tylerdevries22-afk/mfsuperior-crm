import { Feather } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";

import { DriverAvatar } from "@/components/operations";
import type { Customer, Driver, Shipment } from "@/domain/types";

import { styles } from "../styles";
import {
  EQUIPMENT_IMAGES,
  formatTime,
  getAssignedDrivers,
  getDuration,
  getHoursInTz,
  getLoadColor,
  HOUR_HEIGHT,
  HOURS,
  orderedStops,
  scheduledEnd,
  scheduledStart,
} from "../utils";
import { SegmentBar } from "./SegmentBar";

/**
 * Ported from the Appliance Diagnostic Systems `DayTimeline` at
 * 480991b7eb0036e4e85c37d3784b2de2ca97d10d, including the overlap-splitting
 * layout, the 6am-to-10pm hour grid, and the live now-line.
 */

interface LayoutBlock {
  readonly shipment: Shipment;
  readonly top: number;
  readonly height: number;
  readonly left: number;
  readonly width: number;
}

function layoutOverlappingLoads(shipments: readonly Shipment[]): LayoutBlock[] {
  if (!shipments.length) return [];
  const blocks: LayoutBlock[] = shipments.map((shipment) => {
    const startIso = scheduledStart(shipment);
    const endIso = scheduledEnd(shipment);
    const start = startIso
      ? getHoursInTz(startIso)
      : { hours: 8, minutes: 0, h12: 8, ampm: "AM" };
    const end = endIso
      ? getHoursInTz(endIso)
      : { hours: start.hours + 1, minutes: 0, h12: 9, ampm: "AM" };
    const startMinutes = start.hours * 60 + start.minutes;
    const endMinutes = end.hours * 60 + end.minutes;
    /**
     * The grid only spans 6am-10pm. Freight runs outside those hours far more
     * often than appliance service calls do, so a block is clamped to the grid
     * instead of being drawn off the top, which would carry its label out of
     * view with it.
     */
    const gridStart = HOURS[0] * 60;
    const gridEnd = (HOURS[HOURS.length - 1] + 1) * 60;
    const clampedStart = Math.min(Math.max(startMinutes, gridStart), gridEnd);
    const clampedEnd = Math.min(Math.max(endMinutes, clampedStart), gridEnd);
    const top = ((clampedStart - gridStart) / 60) * HOUR_HEIGHT;
    const height = Math.max(((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT, HOUR_HEIGHT * 0.5);
    return { shipment, top, height, left: 0, width: 1 };
  });

  const groups: number[][] = [];
  const assigned = new Set<number>();
  for (let i = 0; i < blocks.length; i += 1) {
    if (assigned.has(i)) continue;
    const group = [i];
    assigned.add(i);
    for (let j = i + 1; j < blocks.length; j += 1) {
      const a = blocks[i];
      const b = blocks[j];
      if (b.top < a.top + a.height && a.top < b.top + b.height) {
        group.push(j);
        assigned.add(j);
      }
    }
    groups.push(group);
  }

  const positioned = blocks.map((block) => ({ ...block }));
  for (const group of groups) {
    const n = group.length;
    group.forEach((idx, pos) => {
      positioned[idx].left = pos / n;
      positioned[idx].width = 1 / n;
    });
  }
  return positioned;
}

interface DayTimelineProps {
  readonly shipments: readonly Shipment[];
  readonly onPress: (shipmentId: string) => void;
  readonly driverColors: Record<string, string>;
  readonly drivers: readonly Driver[];
  readonly customersById: Readonly<Record<string, Customer>>;
}

export function DayTimeline({
  shipments,
  onPress,
  driverColors,
  drivers,
  customersById,
}: DayTimelineProps) {
  const [nowMinutes, setNowMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setNowMinutes(now.getHours() * 60 + now.getMinutes());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const blocks = layoutOverlappingLoads(shipments);
  const nowTop = ((nowMinutes - 6 * 60) / 60) * HOUR_HEIGHT;

  return (
    <View style={styles.dayViewContainer}>
      <View style={styles.timeGutter}>
        {HOURS.map((h) => (
          <View key={h} style={styles.hourRow}>
            <Text style={styles.hourLabel}>
              {h === 12 ? "12 PM" : h < 12 ? `${h} AM` : `${h - 12} PM`}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.dayGrid}>
        {HOURS.map((h) => (
          <View key={h} style={styles.hourGridRow}>
            <View style={styles.hourGridLine} />
          </View>
        ))}

        {nowMinutes >= 6 * 60 && nowMinutes <= 22 * 60 ? (
          <View style={[styles.nowLine, { top: nowTop }]}>
            <View style={styles.nowDot} />
            <View style={styles.nowLineBar} />
          </View>
        ) : null}

        {blocks.map(({ shipment, top, height, left, width }) => {
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
              key={shipment.id}
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
        })}
      </View>
    </View>
  );
}
