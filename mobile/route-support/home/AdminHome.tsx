import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";

import {
  AnimatedPressable,
  Eyebrow,
  FadeInView,
  Header,
  StatTile,
  Title,
} from "@/components/ui";
import { useOperations } from "@/store";
import { SPACING, THEME } from "@/theme";

import { adminS, s } from "./homeStyles";
import { AttentionCard } from "./_components/AttentionCard";
import { DriverAvatarStrip } from "./_components/DriverAvatarStrip";
import { LoadHeroCard } from "./_components/LoadHeroCard";
import { TodayLoadsRail } from "./_components/TodayLoadsRail";
import { formatCurrency, formattedDate, greetingFor } from "./homeUtils";
import { useAdminHomeData } from "./useAdminHomeData";

/**
 * Ported from the Appliance Diagnostic Systems `AdminHome` at
 * 480991b7eb0036e4e85c37d3784b2de2ca97d10d: pull-to-refresh scroll, a
 * staggered `FadeInView` sequence, the eyebrow/title/subtitle header row with
 * its trailing analytics action, a four-tile `StatTile` grid, a
 * "Needs your attention" `WorkspaceCard` of review rows, the team avatar
 * strip, a hero card for the next item, and a snapping rail for today.
 */
export function AdminHome() {
  const router = useRouter();
  const { actions, currentAccount, shipments, state } = useOperations();
  const [refreshing, setRefreshing] = useState(false);

  const customersById = useMemo(
    () => Object.fromEntries(state.customers.map((c) => [c.id, c])),
    [state.customers],
  );
  const driversById = useMemo(() => Object.fromEntries(state.drivers.map((driver) => [driver.id, driver])), [state.drivers]);
  const vehicleForDriver = useCallback((driverId?: string) => state.vehicles.find((vehicle) => vehicle.assignedDriverId === driverId), [state.vehicles]);

  const { attention, delivered, inTransit, nextLoad, revenueCents, todayLoads } =
    useAdminHomeData(shipments, state.exceptions);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await actions.restoreSession();
    } finally {
      setRefreshing(false);
    }
  }, [actions]);

  const openLoad = useCallback(
    (id: string) => router.push({ params: { id }, pathname: "/load/[id]" }),
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
            <AttentionCard items={attention} />
          </FadeInView>
        ) : null}

        <FadeInView delay={140}>
          <DriverAvatarStrip
            drivers={state.drivers}
            onDriverPress={(driver) =>
              router.push({ params: { driverId: driver.id }, pathname: "/(tabs)/schedule" })
            }
            onViewSchedule={() => router.push("/(tabs)/schedule")}
          />
        </FadeInView>

        {nextLoad ? (
          <FadeInView delay={160}>
            <Text style={s.sectionLabel}>NEXT LOAD</Text>
            <LoadHeroCard
              customer={customersById[nextLoad.customerId]}
              driver={nextLoad.assignedDriverId ? driversById[nextLoad.assignedDriverId] : undefined}
              onPress={() => openLoad(nextLoad.id)}
              shipment={nextLoad}
              style={{ marginBottom: SPACING.lg }}
              vehicle={vehicleForDriver(nextLoad.assignedDriverId)}
            />
          </FadeInView>
        ) : null}

        {todayLoads.length > 0 ? (
          <FadeInView delay={180}>
            <TodayLoadsRail
              customersById={customersById}
              driversById={driversById}
              loads={todayLoads}
              onOpenLoad={openLoad}
              onSeeAll={() => router.push("/(tabs)/schedule")}
              vehicleForDriver={vehicleForDriver}
            />
          </FadeInView>
        ) : null}
      </ScrollView>
    </View>
  );
}
