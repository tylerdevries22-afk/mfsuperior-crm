import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ProgressTrack } from "@/components/operations";
import { Button, Card, EmptyState, Header, ListRow, Screen, SectionHeader, StatusBadge } from "@/components/ui";
import { HOS_DUTY_STATUSES, type HosDutyStatus } from "@/domain/types";
import { HOS_LIMITS } from "@/domain/transitions";
import { formatMinutes, formatStatus, remainingMinutes } from "@/lib/operations-format";
import { useOperations } from "@/store";
import { ICON, RADIUS, SPACE, TYPO, useTheme } from "@/theme";

const STATUS_ICONS: Readonly<Record<HosDutyStatus, "bed-outline" | "moon-outline" | "car-outline" | "construct-outline">> = {
  off_duty: "moon-outline",
  sleeper_berth: "bed-outline",
  driving: "car-outline",
  on_duty_not_driving: "construct-outline",
};

export default function HoursOfServiceScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { effectiveRole, hosClock, activeShipment, error, actions } = useOperations();
  const [pendingStatus, setPendingStatus] = useState<HosDutyStatus | null>(null);

  if (effectiveRole !== "driver" || !hosClock) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]}>
        <Header centered onBack={() => router.back()} showBack title="Hours of service" />
        <Screen safeEdges={["left", "right", "bottom"]}>
          <EmptyState actionLabel="Return home" description="Switch to the Driver demo role to view and update the local HOS clock." onAction={() => router.replace("/(tabs)")} title="Driver role required" />
        </Screen>
      </View>
    );
  }

  const driveRemaining = remainingMinutes(hosClock.drivingMinutesUsed, HOS_LIMITS.drivingMinutes);
  const shiftRemaining = remainingMinutes(hosClock.shiftMinutesUsed, HOS_LIMITS.shiftMinutes);
  const cycleRemaining = remainingMinutes(hosClock.cycleMinutesUsed, HOS_LIMITS.cycleMinutes);
  const breakRemaining = remainingMinutes(hosClock.minutesSinceQualifyingBreak, HOS_LIMITS.breakRequiredAfterMinutes);

  const changeStatus = async (status: HosDutyStatus) => {
    if (status === hosClock.status) return;
    setPendingStatus(status);
    await actions.transitionDutyStatus(status);
    setPendingStatus(null);
  };

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Header centered onBack={() => router.back()} showBack subtitle="Driver demo" title="Hours of service" />
      <Screen safeEdges={["left", "right", "bottom"]} scroll contentContainerStyle={styles.content}>

        <Card>
          <View style={styles.statusHero}>
            <View style={[styles.statusIcon, { backgroundColor: theme.primaryMuted }]}>
              <Ionicons color={theme.primaryLight} name={STATUS_ICONS[hosClock.status]} size={ICON.xl} />
            </View>
            <View style={styles.grow}>
              <Text style={[styles.eyebrow, { color: theme.primaryLight }]}>CURRENT DUTY STATUS</Text>
              <Text style={[styles.statusTitle, { color: theme.text }]}>{formatStatus(hosClock.status)}</Text>
              <Text style={[styles.body, { color: theme.textSecondary }]}>Since {new Date(hosClock.statusStartedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Text>
            </View>
            <StatusBadge status={activeShipment ? "active load" : "no active load"} tone={activeShipment ? "success" : "neutral"} />
          </View>
        </Card>

        <SectionHeader title="Change duty status" />
        <View style={styles.statusGrid}>
          {HOS_DUTY_STATUSES.map((status) => {
            const active = status === hosClock.status;
            return (
              <Button
                disabled={active}
                icon={<Ionicons color={active ? theme.textMuted : theme.text} name={STATUS_ICONS[status]} size={ICON.md} />}
                key={status}
                loading={pendingStatus === status}
                onPress={() => void changeStatus(status)}
                style={styles.statusButton}
                title={formatStatus(status)}
                variant={active ? "outline" : "secondary"}
              />
            );
          })}
        </View>

        {error ? (
          <View accessibilityRole="alert" style={[styles.errorCard, { backgroundColor: theme.dangerMuted, borderColor: theme.tint.danger.medium }]}>
            <Ionicons color={theme.danger} name="alert-circle-outline" size={ICON.md} />
            <Text style={[styles.errorText, { color: theme.danger }]}>{error.message}</Text>
            <Button onPress={actions.clearError} size="sm" title="Dismiss" variant="ghost" />
          </View>
        ) : null}

        <SectionHeader title="Available time" />
        <Card>
          <ClockMetric label="Driving" remaining={driveRemaining} total={HOS_LIMITS.drivingMinutes} used={hosClock.drivingMinutesUsed} />
          <ClockMetric label="Shift" remaining={shiftRemaining} total={HOS_LIMITS.shiftMinutes} used={hosClock.shiftMinutesUsed} />
          <ClockMetric label="Cycle" remaining={cycleRemaining} total={HOS_LIMITS.cycleMinutes} used={hosClock.cycleMinutesUsed} />
          <ClockMetric label="Until break" remaining={breakRemaining} total={HOS_LIMITS.breakRequiredAfterMinutes} used={hosClock.minutesSinceQualifyingBreak} />
        </Card>

        <SectionHeader title="Today" />
        <View style={styles.metricGrid}>
          <Card padding="compact" style={styles.metricCard}>
            <Text style={[styles.metricValue, { color: theme.text }]}>{formatMinutes(hosClock.offDutyMinutesToday)}</Text>
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Off duty</Text>
          </Card>
          <Card padding="compact" style={styles.metricCard}>
            <Text style={[styles.metricValue, { color: theme.text }]}>{hosClock.breaksTakenToday}</Text>
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Qualifying breaks</Text>
          </Card>
        </View>

        <SectionHeader title="Duty log" />
        {hosClock.entries.length ? (
          <Card padding="none">
            {hosClock.entries.slice().reverse().map((entry, index) => (
              <ListRow
                isLast={index === hosClock.entries.length - 1}
                key={entry.id}
                meta={formatMinutes(entry.durationMinutes)}
                subtitle={`${entry.locationDescription} · ${new Date(entry.startedAt).toLocaleString()}`}
                title={formatStatus(entry.status)}
                trailing={<StatusBadge status="simulated" tone="warning" />}
              />
            ))}
          </Card>
        ) : (
          <Card>
            <Text style={[styles.body, { color: theme.textSecondary }]}>Change duty status to create the first local log entry.</Text>
          </Card>
        )}
      </Screen>
    </View>
  );
}

function ClockMetric({ label, used, remaining, total }: { readonly label: string; readonly used: number; readonly remaining: number; readonly total: number }) {
  const theme = useTheme();
  const ratio = total === 0 ? 0 : used / total;
  return (
    <View style={styles.clockMetric}>
      <View style={styles.clockHeader}>
        <Text style={[styles.clockLabel, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.clockValue, { color: remaining < 60 ? theme.warning : theme.textSecondary }]}>{formatMinutes(remaining)} left</Text>
      </View>
      <ProgressTrack tone={remaining < 60 ? "warning" : "brand"} value={ratio} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { ...TYPO.body },
  clockHeader: { alignItems: "center", flexDirection: "row", gap: SPACE.md, justifyContent: "space-between" },
  clockLabel: { ...TYPO.bodyStrong },
  clockMetric: { gap: SPACE.xs },
  clockValue: { ...TYPO.captionStrong },
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  errorCard: { alignItems: "center", borderRadius: RADIUS.md, borderWidth: 1, flexDirection: "row", gap: SPACE.sm, padding: SPACE.md },
  errorText: { ...TYPO.captionStrong, flex: 1 },
  eyebrow: { ...TYPO.eyebrow },
  fill: { flex: 1 },
  grow: { flex: 1, gap: SPACE.xs },
  metricCard: { flexBasis: "46%", flexGrow: 1 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  metricLabel: { ...TYPO.caption },
  metricValue: { ...TYPO.metric },
  statusButton: { flexBasis: "47%", flexGrow: 1 },
  statusGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  statusHero: { alignItems: "center", flexDirection: "row", gap: SPACE.md },
  statusIcon: { alignItems: "center", borderRadius: RADIUS.md, height: 58, justifyContent: "center", width: 58 },
  statusTitle: { ...TYPO.heading },
});
