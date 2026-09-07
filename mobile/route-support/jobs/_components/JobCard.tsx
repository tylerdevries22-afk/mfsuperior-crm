import Feather from "@expo/vector-icons/Feather";
import { Text, View } from "react-native";

import { DriverAvatar } from "@/components/operations";
import { AnimatedButton, Badge, Card, StatusBadge } from "@/components/ui";
import { type JobEntry } from "@/route-support/jobs/utils";
import { driverFullName, formatTime } from "@/route-support/schedule/utils";
import { ICON, useTheme } from "@/theme";

import { styles } from "../styles";

/** One load on the dispatch board, with the action its lane allows. */
export function JobCard({
  busy,
  entry,
  onAssign,
  onOpen,
  onRespond,
}: {
  readonly busy: boolean;
  readonly entry: JobEntry;
  readonly onAssign: () => void;
  readonly onOpen: () => void;
  readonly onRespond: (response: "accepted" | "declined") => void;
}) {
  const theme = useTheme();
  const { destination, driver, hasOpenException, origin, shipment, startsAt } = entry;

  return (
    <Card onPress={onOpen}>
      <View style={styles.jobHead}>
        <View style={styles.grow}>
          <Text style={[styles.loadNumber, { color: theme.text }]}>{shipment.loadNumber}</Text>
          <Text style={[styles.route, { color: theme.textSecondary }]}>
            {origin} → {destination}
          </Text>
        </View>
        <StatusBadge size="sm" status={shipment.status} />
      </View>

      <View style={styles.metaRow}>
        <Meta icon="calendar" label={startsAt ? formatTime(startsAt) : "Unscheduled"} />
        <Meta icon="navigation" label={`${shipment.distanceMiles.toLocaleString()} mi`} />
        <Meta icon="package" label={shipment.commodity} />
      </View>

      {hasOpenException ? (
        <View
          accessibilityRole="alert"
          style={[
            styles.exception,
            { backgroundColor: theme.dangerMuted, borderColor: theme.tint.danger.medium },
          ]}
        >
          <Feather color={theme.danger} name="alert-octagon" size={ICON.sm} />
          <Text style={[styles.exceptionText, { color: theme.text }]}>
            An open exception is holding this load.
          </Text>
        </View>
      ) : null}

      <View style={[styles.jobFooter, { borderTopColor: theme.border }]}>
        {driver ? (
          <View style={styles.driverRow}>
            <DriverAvatar driver={driver} ring={false} size={24} />
            <Text style={[styles.driverName, { color: theme.textSecondary }]}>
              {driverFullName(driver)}
            </Text>
          </View>
        ) : (
          <Badge label="No driver" size="sm" tone="warning" />
        )}

        {entry.lane === "tendered" ? (
          <View style={styles.actions}>
            <AnimatedButton
              accessibilityLabel={`Decline ${shipment.loadNumber}`}
              disabled={busy}
              onPress={() => onRespond("declined")}
              size="sm"
              title="Decline"
              variant="ghost"
            />
            <AnimatedButton
              accessibilityLabel={`Accept ${shipment.loadNumber}`}
              disabled={busy}
              onPress={() => onRespond("accepted")}
              size="sm"
              title="Accept"
            />
          </View>
        ) : entry.lane === "closed" ? null : (
          <AnimatedButton
            accessibilityLabel={driver ? `Reassign ${shipment.loadNumber}` : `Assign ${shipment.loadNumber}`}
            disabled={busy}
            onPress={onAssign}
            size="sm"
            title={driver ? "Reassign" : "Assign"}
            variant={driver ? "ghost" : "primary"}
          />
        )}
      </View>
    </Card>
  );
}

function Meta({
  icon,
  label,
}: {
  readonly icon: keyof typeof Feather.glyphMap;
  readonly label: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.meta}>
      <Feather color={theme.textMuted} name={icon} size={ICON.xs} />
      <Text numberOfLines={1} style={[styles.metaLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}
