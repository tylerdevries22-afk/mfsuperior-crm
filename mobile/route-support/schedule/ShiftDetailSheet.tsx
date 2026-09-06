import {
  Button,
  Sheet
} from "@/components/ui";
import type {
  DriverShift
} from "@/domain/types";
import {
  formatDateKey,
  formatTime,
  getDuration
} from "@/route-support/schedule/utils";
import { useOperations } from "@/store";
import { useTheme } from "@/theme";
import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View
} from "react-native";
import { formatSheetDate } from './unifiedHelpers';
import { styles } from './unifiedStyles';

export function ShiftDetailSheet({
  isAdmin,
  now,
  onClose,
  onDelete,
  onEdit,
  onFindCoverage,
  onRetrySync,
  shift,
  sync,
  theme,
}: {
  readonly isAdmin: boolean;
  readonly now: number;
  readonly onClose: () => void;
  readonly onDelete: (shiftId: string) => void;
  readonly onEdit: (shift: DriverShift) => void;
  readonly onFindCoverage: (shift: DriverShift) => void;
  readonly onRetrySync: (shiftId: string) => void;
  readonly shift: DriverShift | null;
  readonly sync?: ReturnType<typeof useOperations>["scheduleSyncStatuses"][number];
  readonly theme: ReturnType<typeof useTheme>;
}) {
  const [showSyncDetails, setShowSyncDetails] = useState(false);
  const [previousShiftId, setPreviousShiftId] = useState(shift?.id);
  if (previousShiftId !== shift?.id) {
    setPreviousShiftId(shift?.id);
    setShowSyncDetails(false);
  }
  if (!shift) return null;
  const future = Date.parse(shift.startsAt) > now;
  return <Sheet onClose={onClose} title="Shift details" visible><ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}><View style={styles.detailTitleRow}><View><Text style={[styles.detailTitle, { color: theme.text }]}>{formatSheetDate(formatDateKey(new Date(shift.startsAt)))}</Text><Text style={[styles.detailTime, { color: theme.primaryLight }]}>{formatTime(shift.startsAt)} – {formatTime(shift.endsAt)} · {getDuration(shift.startsAt, shift.endsAt)}</Text></View><SyncBadge onPress={() => setShowSyncDetails((current) => !current)} status={sync?.status ?? "pending"} theme={theme} /></View><DetailRow label="Status" value={shift.status.replace("_", " ")} theme={theme} /><DetailRow label="Notes" value={shift.note ?? "No notes"} theme={theme} /><View style={[styles.detailCallout, { backgroundColor: theme.tint.primary.soft, borderColor: theme.tint.primary.medium }]}><Feather color={theme.primaryLight} name="link" size={16} /><Text style={[styles.detailCalloutText, { color: theme.textSecondary }]}>Coverage transfers this shift occurrence only. Linked loads stay with their original driver.</Text></View>{showSyncDetails ? <View style={[styles.syncDetails, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}><Text style={[styles.detailRowLabel, { color: theme.textMuted }]}>TARGET SYNC AUDIT</Text><Text style={[styles.syncCopy, { color: theme.textSecondary }]}>{sync?.status === "pending" ? "Waiting for Target credentials or the next integration retry." : sync?.lastError ?? "Target accepted this schedule change."}</Text><Text style={[styles.syncCopy, { color: theme.textMuted }]}>Attempts: {sync?.attempts ?? 0}{sync?.lastAttemptAt ? ` · Last attempt ${formatTime(sync.lastAttemptAt)}` : ""}</Text>{isAdmin ? <Button onPress={() => onRetrySync(shift.id)} size="sm" title="Retry Target sync" variant="outline" /> : null}</View> : null}<View style={styles.sheetActions}>{future ? <Button fullWidth icon={<Feather color={theme.primaryForeground} name="users" size={16} />} onPress={() => onFindCoverage(shift)} title="Find coverage" /> : null}{isAdmin ? <Button fullWidth onPress={() => onEdit(shift)} title="Edit shift" variant="secondary" /> : null}{isAdmin ? <Button fullWidth onPress={() => onDelete(shift.id)} title="Remove shift" variant="danger" /> : null}</View></ScrollView></Sheet>;
}

export function SyncBadge({ onPress, status, theme }: { readonly onPress: () => void; readonly status: "pending" | "synced" | "failed"; readonly theme: ReturnType<typeof useTheme> }) {
  const color = status === "synced" ? theme.primary : status === "failed" ? theme.danger : theme.warning;
  const label = status === "synced" ? "Target synced" : status === "failed" ? "Sync failed" : "Target pending";
  return <Pressable accessibilityLabel={`${label}. Show sync details`} accessibilityRole="button" onPress={onPress} style={[styles.syncBadge, { backgroundColor: `${color}20`, borderColor: `${color}80` }]}><View style={[styles.syncDot, { backgroundColor: color }]} /><Text style={[styles.syncBadgeText, { color }]}>{label}</Text></Pressable>;
}

export function DetailRow({ label, theme, value }: { readonly label: string; readonly theme: ReturnType<typeof useTheme>; readonly value: string }) {
  return <View style={[styles.detailRow, { borderBottomColor: theme.border }]}><Text style={[styles.detailRowLabel, { color: theme.textMuted }]}>{label}</Text><Text style={[styles.detailRowValue, { color: theme.text }]}>{value}</Text></View>;
}
