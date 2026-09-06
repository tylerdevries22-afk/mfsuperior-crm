import {
  Button
} from "@/components/ui";
import type {
  Driver,
  DriverShift,
  ShiftCoverageRequest
} from "@/domain/types";
import {
  formatDateKey,
  formatTime
} from "@/route-support/schedule/utils";
import { useTheme } from "@/theme";
import { Feather } from "@expo/vector-icons";
import {
  Text,
  View
} from "react-native";
import { styles } from './unifiedStyles';

export function CoverageInbox({
  currentDriver,
  drivers,
  isAdmin,
  onRespond,
  requests,
  shifts,
  theme,
}: {
  readonly currentDriver: Driver | null;
  readonly drivers: readonly Driver[];
  readonly isAdmin: boolean;
  readonly onRespond: (requestId: string, response: "accepted" | "declined") => void;
  readonly requests: readonly ShiftCoverageRequest[];
  readonly shifts: readonly DriverShift[];
  readonly theme: ReturnType<typeof useTheme>;
}) {
  const visible = requests.filter((request) => request.status === "pending" && (isAdmin || request.targetDriverId === currentDriver?.id || request.fromDriverId === currentDriver?.id));
  if (visible.length === 0) return null;
  return <View style={[styles.inbox, { backgroundColor: theme.surface, borderColor: theme.border }]}><View style={styles.sectionHeading}><View><Text style={[styles.sectionEyebrow, { color: theme.primaryLight }]}>{isAdmin ? "COVERAGE QUEUE" : "ACTION NEEDED"}</Text><Text style={[styles.sectionTitle, { color: theme.text }]}>{isAdmin ? "Waiting for driver approval" : "Shift coverage requests"}</Text></View><Feather color={theme.primaryLight} name="repeat" size={18} /></View>{visible.map((request) => { const shift = shifts.find((candidate) => candidate.id === request.shiftId); const from = drivers.find((driver) => driver.id === request.fromDriverId); const target = drivers.find((driver) => driver.id === request.targetDriverId); if (!shift) return null; return <View key={request.id} style={[styles.requestRow, { borderTopColor: theme.border }]}><View style={styles.requestCopy}><Text style={[styles.requestTitle, { color: theme.text }]}>{from?.firstName ?? "Driver"} → {target?.firstName ?? "Driver"}</Text><Text style={[styles.requestMeta, { color: theme.textSecondary }]}>{formatDateKey(new Date(shift.startsAt))} · {formatTime(shift.startsAt)}–{formatTime(shift.endsAt)}</Text><Text style={[styles.requestMeta, { color: theme.textMuted }]}>Only this shift moves · linked loads stay assigned</Text></View>{!isAdmin && request.targetDriverId === currentDriver?.id ? <View style={styles.requestActions}><Button onPress={() => onRespond(request.id, "declined")} size="sm" title="Decline" variant="ghost" /><Button onPress={() => onRespond(request.id, "accepted")} size="sm" title="Accept" /></View> : null}</View>; })}</View>;
}
