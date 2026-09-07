import { FlatList, Text, useWindowDimensions, View } from "react-native";

import { AnimatedPressable } from "@/components/ui";
import type { Customer, Driver, Shipment, Vehicle } from "@/domain/types";
import { SPACING } from "@/theme";

import { s } from "../homeStyles";
import { LoadHeroCard } from "./LoadHeroCard";

const CARD_WIDTH_RATIO = 0.82;

/** Today's loads as a snapping horizontal rail, one hero card per load. */
export function TodayLoadsRail({
  customersById,
  driversById,
  loads,
  onOpenLoad,
  onSeeAll,
  vehicleForDriver,
}: {
  readonly customersById: Record<string, Customer>;
  readonly driversById: Record<string, Driver>;
  readonly loads: readonly Shipment[];
  readonly onOpenLoad: (id: string) => void;
  readonly onSeeAll: () => void;
  readonly vehicleForDriver: (driverId?: string) => Vehicle | undefined;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = screenWidth * CARD_WIDTH_RATIO;

  return (
    <>
      <View style={s.sectionHeaderRow}>
        <Text style={s.sectionLabel}>TODAY&apos;S LOADS</Text>
        <AnimatedPressable haptic="selection" onPress={onSeeAll}>
          <Text style={s.seeAllText}>Full Schedule</Text>
        </AnimatedPressable>
      </View>
      <FlatList
        contentContainerStyle={{ paddingRight: SPACING.lg }}
        data={loads}
        decelerationRate="fast"
        horizontal
        keyExtractor={(item) => item.id}
        nestedScrollEnabled
        renderItem={({ item }) => (
          <LoadHeroCard
            customer={customersById[item.customerId]}
            driver={item.assignedDriverId ? driversById[item.assignedDriverId] : undefined}
            onPress={() => onOpenLoad(item.id)}
            shipment={item}
            style={{ marginRight: SPACING.md, width: cardWidth }}
            vehicle={vehicleForDriver(item.assignedDriverId)}
          />
        )}
        showsHorizontalScrollIndicator={false}
        snapToAlignment="start"
        snapToInterval={cardWidth + SPACING.md}
        style={{ marginBottom: SPACING.lg }}
      />
    </>
  );
}
