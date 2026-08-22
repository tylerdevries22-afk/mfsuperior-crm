import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, ScrollView, Text, useWindowDimensions, View } from "react-native";

import {
  AnimatedPressable,
  Eyebrow,
  FadeInView,
  Header,
  StatTile,
  Title,
  WorkspaceCard,
} from "@/components/ui";
import type { Shipment } from "@/domain/types";
import { formatDateKey, scheduledStart } from "@/route-support/schedule/utils";
import { useOperations } from "@/store";
import { SPACING, THEME } from "@/theme";

import { adminS, s } from "./homeStyles";
import { DriverAvatarStrip } from "./_components/DriverAvatarStrip";
import { LoadHeroCard } from "./_components/LoadHeroCard";
import { formatCurrency, formattedDate, greetingFor } from "./homeUtils";

/**
 * Ported from the Appliance Diagnostic Systems `AdminHome` at
 * 480991b7eb0036e4e85c37d3784b2de2ca97d10d: pull-to-refresh scroll, a
 * staggered `FadeInView` sequence, the eyebrow/title/subtitle header row with
 * its trailing analytics action, a four-tile `StatTile` grid, a
 * "Needs your attention" `WorkspaceCard` of review rows, the team avatar
 * strip, a hero card for the next item, and a snapping rail for today.
 */
const CLOSED = new Set(["delivered", "declined", "cancelled"]);

export function AdminHome() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const { actions, currentAccount, shipments, state } = useOperations();
  const [refreshing, setRefreshing] = useState(false);

  const customersById = useMemo(
    () => Object.fromEntries(state.customers.map((c) => [c.id, c])),
    [state.customers],
  );

  const active = useMemo(
    () => shipments.filter((shipment) => !CLOSED.has(shipment.status)),
    [shipments],
  );
  const todayKey = formatDateKey(new Date());
  const todayLoads = useMemo(
    () =>
      shipments.filter((shipment) => {
        const start = scheduledStart(shipment);
        return start !== null && formatDateKey(new Date(start)) === todayKey;
      }),
    [shipments, todayKey],
  );
  const delivered = useMemo(
    () => todayLoads.filter((shipment) => shipment.status === "delivered").length,
    [todayLoads],
  );
  const inTransit = useMemo(
    () => active.filter((shipment) => shipment.status === "in_transit").length,
    [active],
  );
  const revenueCents = useMemo(
    () =>
      todayLoads.reduce(
        (total, { charges }) =>
          total + charges.linehaulCents + charges.fuelSurchargeCents + charges.accessorialsCents,
        0,
      ),
    [todayLoads],
  );

  const openExceptions = state.exceptions.filter((item) => item.status !== "resolved");
  const tenders = shipments.filter((shipment) => shipment.status === "tendered");
  const unassigned = active.filter((shipment) => !shipment.assignedDriverId);

  const attention = useMemo(
    () =>
      [
        openExceptions.length > 0 && {
          key: "exceptions",
          title: `${openExceptions.length} exception${openExceptions.length === 1 ? "" : "s"} open`,
          hint: "Review and resolve before they affect delivery",
          onPress: () => router.push("/exception-diagnostic"),
        },
        tenders.length > 0 && {
          key: "tenders",
          title: `${tenders.length} tender${tenders.length === 1 ? "" : "s"} awaiting response`,
          hint: "Accept or decline before the offer expires",
          onPress: () => router.push("/(tabs)/schedule"),
        },
        unassigned.length > 0 && {
          key: "unassigned",
          title: `${unassigned.length} load${unassigned.length === 1 ? "" : "s"} without a driver`,
          hint: "Assign capacity to keep the lane on schedule",
          onPress: () => router.push("/(tabs)/schedule"),
        },
      ].filter(Boolean) as readonly {
        key: string;
        title: string;
        hint: string;
        onPress: () => void;
      }[],
    [openExceptions.length, router, tenders.length, unassigned.length],
  );

  const nextLoad: Shipment | undefined = useMemo(
    () =>
      [...active]
        .filter((shipment) => scheduledStart(shipment) !== null)
        .sort((a, b) => (scheduledStart(a) ?? "").localeCompare(scheduledStart(b) ?? ""))[0],
    [active],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await actions.restoreSession();
    } finally {
      setRefreshing(false);
    }
  }, [actions]);

  const openLoad = useCallback(
    (id: string) => router.push({ pathname: "/load/[id]", params: { id } }),
    [router],
  );

  return (
    <View style={s.container}>
      <Header showLogo />
      <ScrollView
        // MF's floating tab bar overlays the scroll view, unlike the
        // reference's native tab bar which insets content automatically.
        contentContainerStyle={[adminS.scroll, { paddingBottom: 112 }]}
        refreshControl={
          <RefreshControl
            onRefresh={handleRefresh}
            refreshing={refreshing}
            tintColor={THEME.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <FadeInView delay={0}>
          <View style={adminS.headerRow}>
            <View style={adminS.headerCopy}>
              <Eyebrow>Team overview</Eyebrow>
              <Title>{greetingFor(currentAccount?.displayName)}</Title>
              <Text style={adminS.headerSubtitle}>
                {`${formattedDate()} · ${todayLoads.length} ${todayLoads.length === 1 ? "load" : "loads"} today`}
              </Text>
            </View>
            <AnimatedPressable
              accessibilityLabel="Open analytics"
              accessibilityRole="button"
              haptic="selection"
              onPress={() => router.push("/analytics")}
              style={adminS.headerAction}
            >
              <Feather color={THEME.primaryLight} name="bar-chart-2" size={18} />
            </AnimatedPressable>
          </View>
        </FadeInView>

        <FadeInView delay={60}>
          <View style={adminS.tiles}>
            <StatTile
              label="Loads today"
              onPress={() => router.push("/(tabs)/schedule")}
              value={String(todayLoads.length)}
            />
            <StatTile
              hint={todayLoads.length > 0 ? `of ${todayLoads.length}` : undefined}
              label="Delivered"
              onPress={() => router.push("/(tabs)/schedule")}
              value={String(delivered)}
            />
            <StatTile
              label="In transit"
              onPress={() => router.push("/(tabs)/schedule")}
              value={String(inTransit)}
            />
            <StatTile
              hint="today"
              label="Revenue"
              onPress={() => router.push("/analytics")}
              value={formatCurrency(revenueCents)}
            />
          </View>
        </FadeInView>

        {attention.length > 0 ? (
          <FadeInView delay={90}>
            <WorkspaceCard title="Needs your attention">
              {attention.map((row) => (
                <View key={row.key} style={adminS.attentionRow}>
                  <View style={adminS.attentionCopy}>
                    <Text style={adminS.attentionTitle}>{row.title}</Text>
                    <Text style={adminS.attentionHint}>{row.hint}</Text>
                  </View>
                  <AnimatedPressable
                    accessibilityLabel={row.title}
                    accessibilityRole="button"
                    haptic="selection"
                    onPress={row.onPress}
                    style={adminS.attentionButton}
                  >
                    <Text style={adminS.attentionButtonText}>Review</Text>
                  </AnimatedPressable>
                </View>
              ))}
            </WorkspaceCard>
          </FadeInView>
        ) : null}

        <FadeInView delay={140}>
          <DriverAvatarStrip
            drivers={state.drivers}
            onDriverPress={(driver) =>
              router.push({ pathname: "/(tabs)/schedule", params: { driverId: driver.id } })
            }
            onViewSchedule={() => router.push("/(tabs)/schedule")}
          />
        </FadeInView>

        {nextLoad ? (
          <FadeInView delay={160}>
            <Text style={s.sectionLabel}>NEXT LOAD</Text>
            <LoadHeroCard
              customer={customersById[nextLoad.customerId]}
              onPress={() => openLoad(nextLoad.id)}
              shipment={nextLoad}
              style={{ marginBottom: SPACING.lg }}
            />
          </FadeInView>
        ) : null}

        {todayLoads.length > 0 ? (
          <FadeInView delay={180}>
            <View style={s.sectionHeaderRow}>
              <Text style={s.sectionLabel}>TODAY&apos;S LOADS</Text>
              <AnimatedPressable haptic="selection" onPress={() => router.push("/(tabs)/schedule")}>
                <Text style={s.seeAllText}>Full Schedule</Text>
              </AnimatedPressable>
            </View>
            <FlatList
              contentContainerStyle={{ paddingRight: SPACING.lg }}
              data={todayLoads}
              decelerationRate="fast"
              horizontal
              keyExtractor={(item) => item.id}
              nestedScrollEnabled
              renderItem={({ item }) => (
                <LoadHeroCard
                  customer={customersById[item.customerId]}
                  onPress={() => openLoad(item.id)}
                  shipment={item}
                  style={{ width: screenWidth * 0.82, marginRight: SPACING.md }}
                />
              )}
              showsHorizontalScrollIndicator={false}
              snapToAlignment="start"
              snapToInterval={screenWidth * 0.82 + SPACING.md}
              style={{ marginBottom: SPACING.lg }}
            />
          </FadeInView>
        ) : null}
      </ScrollView>
    </View>
  );
}
