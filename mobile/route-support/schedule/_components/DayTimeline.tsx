import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import type { Customer, Driver, Shipment } from "@/domain/types";

import { styles } from "../styles";
import { HOUR_HEIGHT, HOURS } from "../utils";
import { DayTimelineBlock } from "./DayTimelineBlock";
import { layoutOverlappingLoads } from "./dayTimelineLayout";

/**
 * Ported from the Appliance Diagnostic Systems `DayTimeline` at
 * 480991b7eb0036e4e85c37d3784b2de2ca97d10d, including the overlap-splitting
 * layout, the 6am-to-10pm hour grid, and the live now-line.
 *
 * The overlap maths lives in `./dayTimelineLayout` and a single positioned load
 * in `./DayTimelineBlock`; this file keeps the grid and the now-line.
 */

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

        {blocks.map((block) => (
          <DayTimelineBlock
            block={block}
            customersById={customersById}
            driverColors={driverColors}
            drivers={drivers}
            key={block.shipment.id}
            onPress={onPress}
          />
        ))}
      </View>
    </View>
  );
}
