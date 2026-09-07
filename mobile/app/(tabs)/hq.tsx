import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Text, View } from "react-native";

import { LiveMap } from "@/components/operations";
import { Header } from "@/components/ui";
import { MapBottomSheet } from "@/route-support/hq/_components/MapBottomSheet";
import {
  FleetSheetRow,
  UnassignedSection,
} from "@/route-support/hq/_components/FleetSheetRows";
import { SHEET_INSET_RATIO, TICK_MS } from "@/route-support/hq/constants";
import { styles } from "@/route-support/hq/styles";
import { useHqFleet } from "@/route-support/hq/useHqFleet";

/**
 * HQ — the live operating picture.
 *
 * Replaces the former Capacity tab, which was an equipment/asset register.
 * Freight operations do not run off an equipment inventory here, so HQ answers
 * the question that page never did: where is everything right now.
 *
 * The map/sheet arrangement mirrors the actz-may marketplace: a full-bleed map
 * behind a draggable sheet listing what the map shows, selection synced both
 * ways — tapping a truck raises the sheet to that driver, tapping a row
 * recentres the map on their truck.
 */
export default function HqScreen() {
  const router = useRouter();
  const [headerHeight, setHeaderHeight] = useState(0);
  const {
    customersById,
    focusMarkerId,
    listRef,
    markers,
    moving,
    reduceMotion,
    rows,
    selectDriver,
    selectedId,
    setSheetPosition,
    sheetPosition,
    unassigned,
  } = useHqFleet();

  const openLoad = useCallback(
    (id: string) => router.push({ pathname: "/load/[id]", params: { id } }),
    [router],
  );

  return (
    <View style={styles.fill}>
      <View onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}>
        <Header subtitle="Live operating picture" title="HQ" />
      </View>
      <LiveMap
        bottomInsetRatio={SHEET_INSET_RATIO}
        focusId={focusMarkerId}
        glideMs={reduceMotion ? 0 : TICK_MS}
        markers={markers}
        onSelectMarker={(id) => selectDriver(id)}
        selectedId={selectedId}
      />

      <MapBottomSheet
        onPositionChange={setSheetPosition}
        position={sheetPosition}
        subtitle={`${rows.length} trucks · ${moving} on duty · ${unassigned.length} awaiting a driver`}
        title="Live network"
        topInset={headerHeight}
      >
        <FlatList
          contentContainerStyle={styles.sheetBody}
          data={rows}
          keyExtractor={(row) => row.driver.id}
          ListFooterComponent={
            <UnassignedSection
              customersById={customersById}
              onOpenLoad={openLoad}
              unassigned={unassigned}
            />
          }
          ListHeaderComponent={<Text style={styles.sectionLabel}>FLEET</Text>}
          onScrollToIndexFailed={() => undefined}
          ref={listRef}
          renderItem={({ item }) => (
            <FleetSheetRow
              onSelect={(driverId) => selectDriver(driverId, { recentre: true })}
              row={item}
              selected={selectedId === item.driver.id}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      </MapBottomSheet>
    </View>
  );
}
