import { useTheme } from "@/theme";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  Text,
  View,
  type LayoutChangeEvent
} from "react-native";
import { COLUMNS, DayCell, MonthGridProps, ROWS, styles, WEEKDAY_LABELS } from "./monthGridParts";

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

  // PanResponder stores these handlers; it never calls them during creation.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() => PanResponder.create({
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
  }));

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
