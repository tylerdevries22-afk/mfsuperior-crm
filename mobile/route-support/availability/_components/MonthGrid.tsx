import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";

import { FONTS, RADIUS_DENSE, SPACE, TYPO, useTheme } from "@/theme";

import type { DaySummary, MonthCell } from "../utils";

/**
 * The month grid.
 *
 * A single `PanResponder` covers the whole grid rather than one per cell: a
 * drag has to be able to start on one day and end on another, and per-cell
 * responders each claim their own gesture and never see the crossing. Cell
 * geometry comes from the measured container, so the hit maths cannot drift
 * from the layout the way a hard-coded cell width would.
 */

const ROWS = 6;
const COLUMNS = 7;
const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export interface MonthGridProps {
  readonly cells: readonly MonthCell[];
  readonly summaries: ReadonlyMap<string, DaySummary>;
  readonly todayKey: string;
  readonly selectedKey: string | null;
  readonly onSelectDay: (dateKey: string) => void;
  readonly onSelectRange: (startKey: string, endKey: string) => void;
  /** Fires as the drag crosses into a new day, so the caller can tick haptics. */
  readonly onRangeProgress?: () => void;
}

export function MonthGrid({
  cells,
  onRangeProgress,
  onSelectDay,
  onSelectRange,
  selectedKey,
  summaries,
  todayKey,
}: MonthGridProps) {
  const theme = useTheme();
  const [size, setSize] = useState({ height: 0, width: 0 });
  const [dragRange, setDragRange] = useState<readonly [number, number] | null>(null);

  const sizeRef = useRef(size);
  const cellsRef = useRef(cells);
  const anchorRef = useRef<number | null>(null);
  const lastIndexRef = useRef<number | null>(null);
  const handlersRef = useRef({ onRangeProgress, onSelectDay, onSelectRange });

  useEffect(() => { cellsRef.current = cells; }, [cells]);
  useEffect(() => {
    handlersRef.current = { onRangeProgress, onSelectDay, onSelectRange };
  }, [onRangeProgress, onSelectDay, onSelectRange]);

  const indexFromTouch = useCallback((x: number, y: number): number | null => {
    const { height, width } = sizeRef.current;
    if (width <= 0 || height <= 0) {
      return null;
    }
    const column = Math.floor((x / width) * COLUMNS);
    const row = Math.floor((y / height) * ROWS);
    if (column < 0 || column >= COLUMNS || row < 0 || row >= ROWS) {
      return null;
    }
    return row * COLUMNS + column;
  }, []);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      // A short press is a day selection; only a real drag takes the gesture,
      // so the grid still scrolls inside a pager.
      onMoveShouldSetPanResponder: (_event, gesture) => (
        Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6
      ),
      onPanResponderGrant: (event) => {
        const index = indexFromTouch(event.nativeEvent.locationX, event.nativeEvent.locationY);
        anchorRef.current = index;
        lastIndexRef.current = index;
      },
      onPanResponderMove: (event) => {
        const anchor = anchorRef.current;
        if (anchor === null) {
          return;
        }
        const index = indexFromTouch(event.nativeEvent.locationX, event.nativeEvent.locationY);
        if (index === null || index === lastIndexRef.current) {
          return;
        }
        lastIndexRef.current = index;
        handlersRef.current.onRangeProgress?.();
        setDragRange([Math.min(anchor, index), Math.max(anchor, index)]);
      },
      onPanResponderRelease: () => {
        const anchor = anchorRef.current;
        const last = lastIndexRef.current;
        anchorRef.current = null;
        lastIndexRef.current = null;
        setDragRange(null);
        if (anchor === null || last === null) {
          return;
        }

        const list = cellsRef.current;
        const from = list[Math.min(anchor, last)];
        const to = list[Math.max(anchor, last)];
        if (!from || !to) {
          return;
        }
        if (anchor === last) {
          handlersRef.current.onSelectDay(from.dateKey);
          return;
        }
        handlersRef.current.onSelectRange(from.dateKey, to.dateKey);
      },
      onPanResponderTerminate: () => {
        anchorRef.current = null;
        lastIndexRef.current = null;
        setDragRange(null);
      },
    }),
  ).current;

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout;
    sizeRef.current = { height, width };
    setSize({ height, width });
  }, []);

  const rows = useMemo(() => Array.from(
    { length: ROWS },
    (_, row) => cells.slice(row * COLUMNS, row * COLUMNS + COLUMNS),
  ), [cells]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label, index) => (
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no"
            key={`${label}-${index}`}
            style={[styles.weekday, { color: theme.textMuted }]}
          >
            {label}
          </Text>
        ))}
      </View>

      <View onLayout={onLayout} style={styles.grid} {...responder.panHandlers}>
        {rows.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.row}>
            {row.map((cell, columnIndex) => {
              const index = rowIndex * COLUMNS + columnIndex;
              const summary = summaries.get(cell.dateKey);
              const inDrag = dragRange !== null && index >= dragRange[0] && index <= dragRange[1];
              const isSelected = selectedKey === cell.dateKey;
              const isToday = todayKey === cell.dateKey;

              return (
                <DayCell
                  cell={cell}
                  inDrag={inDrag}
                  isSelected={isSelected}
                  isToday={isToday}
                  key={cell.dateKey}
                  summary={summary}
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

function DayCell({
  cell,
  inDrag,
  isSelected,
  isToday,
  summary,
}: {
  readonly cell: MonthCell;
  readonly inDrag: boolean;
  readonly isSelected: boolean;
  readonly isToday: boolean;
  readonly summary: DaySummary | undefined;
}) {
  const theme = useTheme();
  const coverage = summary?.coverage ?? "open";
  const ringColor = coverage === "off"
    ? theme.danger
    : coverage === "partial"
      ? theme.warning
      : theme.tint.primary.medium;

  return (
    <View
      accessibilityLabel={describeCell(cell, summary, isToday)}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      style={[
        styles.cell,
        inDrag && { backgroundColor: theme.tint.primary.muted },
        isSelected && { backgroundColor: theme.tint.primary.strong },
      ]}
    >
      <View
        style={[
          styles.dayWell,
          { borderColor: coverage === "open" ? "transparent" : ringColor },
          isToday && { backgroundColor: theme.primary },
        ]}
      >
        <Text
          style={[
            styles.dayText,
            { color: cell.inMonth ? theme.text : theme.textMuted },
            isToday && { color: theme.primaryForeground, fontFamily: FONTS.bold },
            !cell.inMonth && styles.dayTextOutside,
          ]}
        >
          {cell.day}
        </Text>
      </View>

      <View style={styles.markers}>
        {summary && summary.loadCount > 0 ? (
          <View
            style={[
              styles.loadDot,
              { backgroundColor: summary.hasConflict ? theme.danger : theme.info },
            ]}
          />
        ) : null}
      </View>
    </View>
  );
}

function describeCell(cell: MonthCell, summary: DaySummary | undefined, isToday: boolean): string {
  const date = new Date(`${cell.dateKey}T12:00:00Z`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    weekday: "long",
  });
  const coverage = summary?.coverage === "off"
    ? "unavailable all day"
    : summary?.coverage === "partial" ? "partly blocked" : "available";
  const loads = summary && summary.loadCount > 0
    ? `, ${summary.loadCount} load${summary.loadCount === 1 ? "" : "s"}${summary.hasConflict ? ", conflicts with blocked time" : ""}`
    : "";
  return `${isToday ? "Today, " : ""}${date}, ${coverage}${loads}`;
}

const styles = StyleSheet.create({
  cell: {
    alignItems: "center",
    borderRadius: RADIUS_DENSE.lg,
    flex: 1,
    gap: 2,
    justifyContent: "center",
    paddingVertical: 4,
  },
  dayText: { ...TYPO.body, fontFamily: FONTS.medium },
  dayTextOutside: { opacity: 0.45 },
  dayWell: {
    alignItems: "center",
    borderRadius: 17,
    borderWidth: 1.5,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  grid: { gap: 2 },
  loadDot: { borderRadius: 2.5, height: 5, width: 5 },
  markers: { alignItems: "center", flexDirection: "row", gap: 3, height: 6 },
  row: { flexDirection: "row", gap: 2 },
  weekday: { ...TYPO.label, flex: 1, textAlign: "center" },
  weekdayRow: { flexDirection: "row", gap: 2 },
  wrapper: { gap: SPACE.xs },
});
