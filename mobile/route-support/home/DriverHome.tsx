import { Feather } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, ScrollView, Text, useWindowDimensions, View } from "react-native";

import { AnimatedPressable, FadeInView, Header } from "@/components/ui";
import { formatDateKey, scheduledStart } from "@/route-support/schedule/utils";
import { useOperations } from "@/store";
import { SPACING, THEME } from "@/theme";

import { LoadHeroCard } from "./_components/LoadHeroCard";
import { InlineError, PulseOrb, StatPill } from "./_components/HomePrimitives";
import { formatCurrency, formattedDate, getGreeting } from "./homeUtils";
import { s } from "./homeStyles";

/**
 * Ported from the Appliance Diagnostic Systems `TechAdminHome` at
 * 480991b7eb0036e4e85c37d3784b2de2ca97d10d: the date/greeting hero with its
 * pulsing live orb, a three-pill stat row, an inline error affordance, and a
 * snapping "UP NEXT" rail followed by quick actions and recent activity.
 */
/** Mirrors the reference's `QUICK_ACTIONS` table, pointing at freight routes. */
const QUICK_ACTIONS: readonly {
  readonly key: string;
  readonly icon: keyof typeof Feather.glyphMap;
  readonly label: string;
  readonly color: string;
  readonly route: Href;
}[] = [
  { key: "hos", icon: "clock", label: "Duty Status", color: THEME.primary, route: "/hours-of-service" },
  { key: "toolbox", icon: "tool", label: "Toolbox", color: THEME.success, route: "/driver-toolbox" },
  { key: "exception", icon: "alert-triangle", label: "Report Issue", color: THEME.orange, route: "/exception-diagnostic" },
  { key: "location", icon: "map-pin", label: "Location", color: "#A78BFA", route: "/location-tracker" },
  { key: "messages", icon: "message-square", label: "Messages", color: THEME.primaryLight, route: "/messages" },
  { key: "history", icon: "clock", label: "History", color: THEME.textMuted, route: "/history" },
];

const CLOSED = new Set(["delivered", "declined", "cancelled"]);

export function DriverHome() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const { actions, currentAccount, error, shipments, state } = useOperations();
  const [refreshing, setRefreshing] = useState(false);

  const greeting = useMemo(() => getGreeting(), []);
  const customersById = useMemo(
    () => Object.fromEntries(state.customers.map((c) => [c.id, c])),
    [state.customers],
  );

  const driverId = currentAccount?.driverId;
  const mine = useMemo(
    () => (driverId ? shipments.filter((shipment) => shipment.assignedDriverId === driverId) : []),
    [driverId, shipments],
  );

  const todayKey = formatDateKey(new Date());
  const todayLoads = useMemo(
    () =>
      mine.filter((shipment) => {
        const start = scheduledStart(shipment);
        return start !== null && formatDateKey(new Date(start)) === todayKey;
      }),
    [mine, todayKey],
  );
  const completedToday = todayLoads.filter((shipment) => shipment.status === "delivered").length;
  const upNext = useMemo(
    () =>
      [...mine]
        .filter((shipment) => !CLOSED.has(shipment.status) && scheduledStart(shipment) !== null)
        .sort((a, b) => (scheduledStart(a) ?? "").localeCompare(scheduledStart(b) ?? "")),
    [mine],
  );
  const payCents = useMemo(
    () =>
      todayLoads.reduce(
        (total, { charges }) =>
          total + charges.linehaulCents + charges.fuelSurchargeCents + charges.accessorialsCents,
        0,
      ),
    [todayLoads],
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
        contentContainerStyle={[s.scroll, { paddingBottom: 112 }]}
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
          <View style={s.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.heroDate}>{formattedDate()}</Text>
              <Text style={s.greetingText}>{greeting.text}</Text>
              <Text style={s.greetingSub}>{greeting.sub}</Text>
            </View>
            <View style={s.heroRight}>
              <View style={s.orbContainer}>
                <PulseOrb color={THEME.primary} delay={0} />
                <PulseOrb color={THEME.success} delay={600} />
                <View style={s.liveIndicator}>
                  <View style={s.liveDotInner} />
                </View>
              </View>
              <Text style={s.liveText}>Live</Text>
            </View>
          </View>
        </FadeInView>

        <FadeInView delay={80}>
          <View style={s.statsRow}>
            <StatPill
              color={THEME.primary}
              icon="truck"
              label="Loads Today"
              onPress={() => router.push("/(tabs)/schedule")}
              value={String(todayLoads.length)}
            />
            <StatPill
              color={THEME.success}
              icon="dollar-sign"
              label="Revenue"
              value={formatCurrency(payCents)}
            />
            <StatPill
              color="#A78BFA"
              icon="check-circle"
              label="Done"
              value={`${completedToday}/${todayLoads.length}`}
            />
          </View>
        </FadeInView>

        {error ? (
          <FadeInView delay={100}>
            <InlineError message="Could not load today's data" onRetry={handleRefresh} />
          </FadeInView>
        ) : null}

        {upNext.length > 0 ? (
          <FadeInView delay={160}>
            <Text style={s.sectionLabel}>UP NEXT</Text>
            <FlatList
              contentContainerStyle={{ paddingRight: SPACING.lg }}
              data={upNext}
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

        <FadeInView delay={240}>
          <Text style={s.sectionLabel}>QUICK ACTIONS</Text>
          <View style={s.actionsGrid}>
            {QUICK_ACTIONS.map((action) => {
              const cardWidth = (screenWidth - SPACING.lg * 2 - SPACING.sm * 2) / 3;
              return (
                <AnimatedPressable
                  accessibilityLabel={action.label}
                  accessibilityRole="button"
                  haptic="selection"
                  key={action.key}
                  onPress={() => router.push(action.route)}
                  style={[s.actionCard, { width: cardWidth }]}
                >
                  <View style={[s.actionIconBg, { backgroundColor: `${action.color}15` }]}>
                    <Feather color={action.color} name={action.icon} size={20} />
                  </View>
                  <Text style={s.actionLabel}>{action.label}</Text>
                </AnimatedPressable>
              );
            })}
          </View>
        </FadeInView>
      </ScrollView>
    </View>
  );
}
