import { Text, View } from "react-native";

import { DriverAvatar } from "@/components/operations";
import { AnimatedPressable, EmptyState, StatusBadge } from "@/components/ui";
import type { Customer, Shipment } from "@/domain/types";
import { STATUS_COLORS, type FleetRow } from "@/route-support/hq/constants";
import { styles } from "@/route-support/hq/styles";
import { driverFullName, orderedStops } from "@/route-support/schedule/utils";
import { THEME } from "@/theme";

/** One driver in the sheet list; tapping it recentres the map on their truck. */
export function FleetSheetRow({ onSelect, row, selected }: {
  readonly onSelect: (driverId: string) => void;
  readonly row: FleetRow;
  readonly selected: boolean;
}) {
  return (
    <AnimatedPressable
      accessibilityLabel={`${driverFullName(row.driver)} on the map`}
      accessibilityRole="button"
      haptic="selection"
      onPress={() => onSelect(row.driver.id)}
      style={[styles.row, selected && styles.rowSelected]}
    >
      <View>
        <DriverAvatar driver={row.driver} ring={false} size={34} />
        <View
          style={[
            styles.rowStatusDot,
            { backgroundColor: STATUS_COLORS[row.driver.status] ?? THEME.textMuted },
          ]}
        />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{driverFullName(row.driver)}</Text>
        <Text numberOfLines={1} style={styles.rowMeta}>
          {row.load
            ? `${row.load.loadNumber} · ${row.load.status.replaceAll("_", " ")}`
            : "No active load"}
        </Text>
      </View>
      <StatusBadge showDot size="sm" status={row.driver.status} />
    </AnimatedPressable>
  );
}

/** The sheet's footer: active loads still waiting on a driver. */
export function UnassignedSection({ customersById, onOpenLoad, unassigned }: {
  readonly customersById: Record<string, Customer>;
  readonly onOpenLoad: (id: string) => void;
  readonly unassigned: readonly Shipment[];
}) {
  return (
    <View style={styles.footer}>
      <Text style={styles.sectionLabel}>AWAITING A DRIVER</Text>
      {unassigned.length === 0 ? (
        <EmptyState
          description="Every active load has a driver assigned."
          title="Nothing waiting"
        />
      ) : (
        unassigned.map((shipment) => {
          const pickup = orderedStops(shipment).find((stop) => stop.type === "pickup");
          return (
            <AnimatedPressable
              accessibilityLabel={`Open load ${shipment.loadNumber}`}
              accessibilityRole="button"
              haptic="selection"
              key={shipment.id}
              onPress={() => onOpenLoad(shipment.id)}
              style={styles.row}
            >
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>
                  {customersById[shipment.customerId]?.companyName ?? shipment.loadNumber}
                </Text>
                <Text numberOfLines={1} style={styles.rowMeta}>
                  {shipment.loadNumber} · {pickup?.address.city ?? "Pickup pending"}
                </Text>
              </View>
              <StatusBadge showDot size="sm" status={shipment.status} />
            </AnimatedPressable>
          );
        })
      )}
    </View>
  );
}
