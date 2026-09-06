import { DriverAvatar } from "@/components/operations";
import {
  AnimatedButton,
  Sheet
} from "@/components/ui";
import { eligibleCoverageDrivers } from "@/domain/scheduling";
import type {
  DriverShift
} from "@/domain/types";
import {
  driverFullName,
  formatDateKey,
  formatTime
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

export function CoverageSheet({ busy, onClose, onSend, shift, state, theme }: { readonly busy: boolean; readonly onClose: () => void; readonly onSend: (shiftId: string, targetDriverId: string) => void; readonly shift: DriverShift | null; readonly state: ReturnType<typeof useOperations>["state"]; readonly theme: ReturnType<typeof useTheme> }) {
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [previousShiftId, setPreviousShiftId] = useState(shift?.id);
  if (previousShiftId !== shift?.id) {
    setPreviousShiftId(shift?.id);
    setSelectedDriverId(null);
  }
  if (!shift) return null;
  const candidates = eligibleCoverageDrivers(state, shift);
  return <Sheet footer={<AnimatedButton accessibilityLabel="Send coverage request" disabled={!selectedDriverId} fullWidth loading={busy} onPress={() => selectedDriverId && onSend(shift.id, selectedDriverId)} title="Send request" />} onClose={onClose} title="Find shift coverage" visible><ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}><Text style={[styles.coverageIntro, { color: theme.textSecondary }]}>Only qualified, available drivers without a shift, blocked time, or load conflict are shown.</Text><View style={[styles.coverageShift, { backgroundColor: theme.tint.primary.soft, borderColor: theme.tint.primary.medium }]}><Text style={[styles.coverageShiftTitle, { color: theme.text }]}>{formatSheetDate(formatDateKey(new Date(shift.startsAt)))}</Text><Text style={[styles.coverageShiftMeta, { color: theme.primaryLight }]}>{formatTime(shift.startsAt)} – {formatTime(shift.endsAt)}</Text></View><Text style={[styles.sheetLabel, { color: theme.textMuted }]}>RANKED ELIGIBLE DRIVERS</Text>{candidates.length === 0 ? <View style={styles.noCandidates}><Feather color={theme.warning} name="alert-triangle" size={22} /><Text style={[styles.noCandidateTitle, { color: theme.text }]}>No eligible drivers</Text><Text style={[styles.noCandidateCopy, { color: theme.textSecondary }]}>Adjust the shift window or resolve a conflict before requesting coverage.</Text></View> : candidates.map(({ driver, rank }) => { const selected = driver.id === selectedDriverId; return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} key={driver.id} onPress={() => setSelectedDriverId(driver.id)} style={[styles.candidateRow, { borderColor: theme.border }, selected && { backgroundColor: theme.tint.primary.medium, borderColor: theme.primaryLight }]}><DriverAvatar driver={driver} ring={false} size={32} /><View style={styles.candidateCopy}><Text style={[styles.candidateName, { color: theme.text }]}>{driverFullName(driver)}</Text><Text style={[styles.candidateMeta, { color: theme.textSecondary }]}>{driver.status.replace("_", " ")} · {rank === 0 ? "Best match" : "No schedule conflicts"}</Text></View>{selected ? <Feather color={theme.primaryLight} name="check-circle" size={19} /> : <Feather color={theme.textMuted} name="circle" size={19} />}</Pressable>; })}</ScrollView></Sheet>;
}
