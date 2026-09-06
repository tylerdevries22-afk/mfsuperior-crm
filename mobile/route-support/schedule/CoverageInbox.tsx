import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { DriverPresence } from "@/components/operations/DriverPresence";
import { Badge, Button } from "@/components/ui";
import type { Driver, DriverShift, ShiftCoverageRequest } from "@/domain/types";
import { formatDateKey, formatTime } from "./utils";
import { SPACE, TYPO, useTheme } from "@/theme";

type Props = {
  readonly currentDriver: Driver | null;
  readonly drivers: readonly Driver[];
  readonly isAdmin: boolean;
  readonly onRespond: (requestId: string, response: "accepted" | "declined") => void;
  readonly requests: readonly ShiftCoverageRequest[];
  readonly shifts: readonly DriverShift[];
  readonly theme: ReturnType<typeof useTheme>;
};

export function CoverageInbox({ currentDriver, drivers, isAdmin, onRespond, requests, shifts, theme }: Props) {
  const visible = requests.filter((request) => request.status === "pending" && (isAdmin || request.targetDriverId === currentDriver?.id || request.fromDriverId === currentDriver?.id));
  if (visible.length === 0) return null;
  return <View style={[styles.inbox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
    <View style={styles.heading}>
      <View style={styles.grow}><Text style={[styles.eyebrow, { color: theme.primaryLight }]}>{isAdmin ? "COVERAGE QUEUE" : "ACTION NEEDED"}</Text><Text style={[styles.title, { color: theme.text }]}>{isAdmin ? "Waiting for driver approval" : "Shift coverage requests"}</Text></View>
      <Badge label={String(visible.length)} tone="warning" />
    </View>
    {visible.map((request) => {
      const shift = shifts.find((candidate) => candidate.id === request.shiftId);
      const from = drivers.find((driver) => driver.id === request.fromDriverId);
      const target = drivers.find((driver) => driver.id === request.targetDriverId);
      if (!shift) return null;
      return <View key={request.id} style={[styles.request, { borderTopColor: theme.border }]}>
        <View style={styles.people}>
          {from ? <Person driver={from} /> : <Text>Driver</Text>}
          <Feather name="arrow-right" size={16} color={theme.textMuted} />
          {target ? <Person driver={target} /> : <Text>Driver</Text>}
          <Badge label="Pending" tone="warning" showDot />
        </View>
        <Text style={[styles.meta, { color: theme.textSecondary }]}>{formatDateKey(new Date(shift.startsAt))} · {formatTime(shift.startsAt)}–{formatTime(shift.endsAt)}</Text>
        <Text style={[styles.meta, { color: theme.textMuted }]}>Only this shift moves · linked loads stay assigned</Text>
        {!isAdmin && request.targetDriverId === currentDriver?.id ? <View style={styles.actions}><Button onPress={() => onRespond(request.id, "declined")} size="sm" title="Decline" variant="ghost" /><Button onPress={() => onRespond(request.id, "accepted")} size="sm" title="Accept" /></View> : null}
      </View>;
    })}
  </View>;
}

function Person({ driver }: { readonly driver: Driver }) {
  const theme = useTheme();
  return <View style={styles.person}><DriverPresence driver={driver} /><Text style={[styles.name, { color: theme.text }]}>{driver.firstName}</Text></View>;
}
const styles = StyleSheet.create({
  inbox: { borderWidth: 1, borderRadius: 16, overflow: "hidden", marginTop: SPACE.sm },
  heading: { flexDirection: "row", alignItems: "center", padding: 12, gap: 8 },
  grow: { flex: 1, minWidth: 0 },
  eyebrow: { ...TYPO.metricLabel },
  title: { ...TYPO.captionStrong, marginTop: 3 },
  request: { borderTopWidth: StyleSheet.hairlineWidth, padding: 12, gap: 6 },
  people: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  person: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { ...TYPO.captionStrong },
  meta: { ...TYPO.subtitle, lineHeight: 17 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
});
