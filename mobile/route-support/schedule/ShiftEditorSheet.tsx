import { DriverAvatar } from "@/components/operations";
import {
  AnimatedButton,
  Button,
  SegmentedControl,
  Sheet,
  TextField
} from "@/components/ui";
import type {
  Driver,
  DriverShift,
  DriverShiftInput
} from "@/domain/types";
import { TimeRangeTrack } from "@/route-support/availability/_components/TimeRangeTrack";
import {
  isoToMinutes,
  minutesToIso
} from "@/route-support/availability/utils";
import {
  formatDateKey
} from "@/route-support/schedule/utils";
import { useTheme } from "@/theme";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  Text
} from "react-native";
import { formatSheetDate } from './unifiedHelpers';
import { styles } from './unifiedStyles';
import { DEFAULT_END, DEFAULT_START } from './unifiedTypes';

export function ShiftEditorSheet({
  busy,
  dateKey,
  driverId,
  drivers,
  onClose,
  onDelete,
  onSave,
  shift,
}: {
  readonly busy: boolean;
  readonly dateKey: string | null;
  readonly driverId?: string;
  readonly drivers: readonly Driver[];
  readonly onClose: () => void;
  readonly onDelete?: () => void;
  readonly onSave: (input: DriverShiftInput) => void;
  readonly shift?: DriverShift;
}) {
  const theme = useTheme();
  const [selectedDriverId, setSelectedDriverId] = useState(shift?.driverId ?? driverId ?? drivers[0]?.id ?? "");
  const [startMinute, setStartMinute] = useState(shift ? isoToMinutes(shift.startsAt, dateKey ?? formatDateKey(new Date(shift.startsAt))) : DEFAULT_START);
  const [endMinute, setEndMinute] = useState(shift ? isoToMinutes(shift.endsAt, dateKey ?? formatDateKey(new Date(shift.startsAt))) : DEFAULT_END);
  const [status, setStatus] = useState<DriverShift["status"]>(shift?.status ?? "scheduled");
  const [note, setNote] = useState(shift?.note ?? "");

  const [previousDraft, setPreviousDraft] = useState({ dateKey, driverId, shift });
  if (previousDraft.dateKey !== dateKey || previousDraft.driverId !== driverId || previousDraft.shift !== shift) {
    setPreviousDraft({ dateKey, driverId, shift });
    setSelectedDriverId(shift?.driverId ?? driverId ?? drivers[0]?.id ?? "");
    setStartMinute(shift ? isoToMinutes(shift.startsAt, dateKey ?? formatDateKey(new Date(shift.startsAt))) : DEFAULT_START);
    setEndMinute(shift ? isoToMinutes(shift.endsAt, dateKey ?? formatDateKey(new Date(shift.startsAt))) : DEFAULT_END);
    setStatus(shift?.status ?? "scheduled");
    setNote(shift?.note ?? "");
  }

  if (!dateKey) return null;
  const heading = shift ? "Edit driver shift" : "Schedule driver shift";
  return <Sheet footer={<><AnimatedButton accessibilityLabel={shift ? "Save shift changes" : "Schedule shift"} fullWidth loading={busy} onPress={() => onSave({ driverId: selectedDriverId, endsAt: minutesToIso(dateKey, endMinute), id: shift?.id, note, startsAt: minutesToIso(dateKey, startMinute), status })} title={shift ? "Save changes" : "Schedule shift"} />{onDelete ? <Button disabled={busy} fullWidth onPress={onDelete} title="Remove shift" variant="danger" /> : null}</>} onClose={onClose} title={heading} visible><ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}><Text style={[styles.sheetLabel, { color: theme.textMuted }]}>DRIVER</Text><ScrollView contentContainerStyle={styles.sheetDriverRow} horizontal showsHorizontalScrollIndicator={false}>{drivers.map((driver) => <Pressable accessibilityState={{ selected: selectedDriverId === driver.id }} accessibilityRole="radio" key={driver.id} onPress={() => setSelectedDriverId(driver.id)} style={[styles.sheetDriver, { borderColor: theme.border }, selectedDriverId === driver.id && { backgroundColor: theme.tint.primary.medium, borderColor: theme.primaryLight }]}><DriverAvatar driver={driver} ring={false} size={22} /><Text style={[styles.sheetDriverText, { color: theme.text }]}>{driver.firstName}</Text></Pressable>)}</ScrollView><Text style={[styles.sheetDate, { color: theme.text }]}>{formatSheetDate(dateKey)}</Text><Text style={[styles.sheetLabel, { color: theme.textMuted }]}>SHIFT WINDOW</Text><TimeRange valueEnd={endMinute} valueStart={startMinute} onChange={(start, end) => { setStartMinute(start); setEndMinute(end); }} /><Text style={[styles.sheetLabel, { color: theme.textMuted }]}>STATUS</Text><SegmentedControl accessibilityLabel="Shift status" onChange={setStatus} options={[{ label: "Scheduled", value: "scheduled" }, { label: "Confirmed", value: "confirmed" }, { label: "In progress", value: "in_progress" }]} value={status === "completed" || status === "cancelled" ? "scheduled" : status} /><TextField label="Notes" onChangeText={setNote} placeholder="Lane, call-out, or dispatch notes" value={note} /></ScrollView></Sheet>;
}

export function TimeRange({ onChange, valueEnd, valueStart }: { readonly onChange: (start: number, end: number) => void; readonly valueEnd: number; readonly valueStart: number }) {
  // The shared availability track gives shifts the same 15-minute precision as blocked time.
  return <TimeRangeTrack accessibilityLabel="Shift time window" endMinute={valueEnd} onChange={onChange} startMinute={valueStart} />;
}
