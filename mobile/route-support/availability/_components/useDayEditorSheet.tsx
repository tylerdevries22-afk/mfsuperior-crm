import type {
  AvailabilityKind, AvailabilityRuleInput
} from "@/domain/types";
import {
  localDayStart, MINUTES_PER_DAY, minutesToIso
} from "@/route-support/availability/utils";
import { useTheme } from "@/theme";
import { useCallback, useMemo, useState } from "react";
import { DayEditorSheetProps } from "./dayEditorParts";

export function useDayEditorSheet({
  dateKey,
  onSaveBlock,
  onSaveRule,
}: DayEditorSheetProps) {

  const theme = useTheme();

  const [kind, setKind] = useState<AvailabilityKind>("unavailable");

  const [startMinute, setStartMinute] = useState(480);

  const [endMinute, setEndMinute] = useState(1_020);

  const [repeatWeekly, setRepeatWeekly] = useState(false);

  // Reopening on a different day starts from a clean default rather than the
  // range left behind by the day before it.
  const [previousDate, setPreviousDate] = useState(dateKey);

  if (previousDate !== dateKey) {
    setPreviousDate(dateKey);
    setKind("unavailable");
    setStartMinute(480);
    setEndMinute(1_020);
    setRepeatWeekly(false);
  }

  const weekday = useMemo(
    () => (dateKey ? localDayStart(dateKey).getDay() : 0),
    [dateKey],
  );

  const onRangeChange = useCallback((nextStart: number, nextEnd: number) => {
    setStartMinute(nextStart);
    setEndMinute(nextEnd);
  }, []);
  const heading = new Date(`${dateKey ?? "2000-01-01"}T12:00:00Z`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    weekday: "long",
  });
  const applyQuickAction = (quickKind: AvailabilityKind) => {
    if (!dateKey) return;
    setKind(quickKind);
    setStartMinute(0);
    setEndMinute(MINUTES_PER_DAY);
    onSaveBlock({
      endsAt: minutesToIso(dateKey, MINUTES_PER_DAY),
      kind: quickKind,
      startsAt: minutesToIso(dateKey, 0),
    });
  };
  const saveRange = () => {
    if (!dateKey) return;
    if (repeatWeekly) {
      onSaveRule({
        effectiveFrom: minutesToIso(dateKey, 0),
        endMinute,
        kind,
        startMinute,
        weekday: weekday as AvailabilityRuleInput["weekday"],
      });
      return;
    }
    onSaveBlock({
      endsAt: minutesToIso(dateKey, endMinute),
      kind,
      startsAt: minutesToIso(dateKey, startMinute),
    });
  };

  return { heading, applyQuickAction, saveRange, theme, kind, setKind, startMinute, setStartMinute, endMinute, setEndMinute, repeatWeekly, setRepeatWeekly, weekday, onRangeChange };
}
