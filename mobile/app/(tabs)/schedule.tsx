import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  LayoutChangeEvent,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { Header } from "@/components/ui";
import { DayTimeline } from "@/route-support/schedule/_components/DayTimeline";
import { DriverFilter } from "@/route-support/schedule/_components/DriverFilter";
import { LoadCard } from "@/route-support/schedule/_components/LoadCard";
import { useScheduleData } from "@/route-support/schedule/_hooks/useScheduleData";
import { useScheduleFilters } from "@/route-support/schedule/_hooks/useScheduleFilters";
import { styles } from "@/route-support/schedule/styles";
import {
  addDays,
  DAYS,
  formatDateKey,
  formatDayHeader,
  isToday,
} from "@/route-support/schedule/utils";
import { useOperations } from "@/store";
import { THEME } from "@/theme";

/**
 * Freight schedule.
 *
 * Structure, interaction model, and styling are ported from the Appliance
 * Diagnostic Systems schedule at 480991b7eb0036e4e85c37d3784b2de2ca97d10d:
 * the scrolling week strip, the list/day toggle, day-grouped cards, the
 * swipeable day timeline, the calendar-view modal, and the floating Today
 * button. Jobs are loads and technicians are drivers.
 */
export default function ScheduleScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const { effectiveRole } = useOperations();
  const isAdmin = effectiveRole === "admin";
  const { driverId: driverIdParam } = useLocalSearchParams<{ driverId?: string }>();

  const { selectedDriverIds, toggleDriver, toggleSelectAll } = useScheduleFilters(driverIdParam);
  const {
    weekDates,
    schedule,
    driverColors,
    drivers,
    customersById,
    exceptionShipmentIds,
    isLoading,
  } = useScheduleData(selectedDriverIds);

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<"list" | "day">("list");
  const [filterVisible, setFilterVisible] = useState(false);

  const listScrollRef = useRef<ScrollView>(null);
  const calendarScrollRef = useRef<ScrollView>(null);
  const dayFlatRef = useRef<FlatList<Date>>(null);
  const isScrollingProgrammatically = useRef(false);
  const sectionYPositions = useRef<Record<string, number>>({});
  const hasAutoScrolled = useRef(false);
  const [todayIsAbove, setTodayIsAbove] = useState(false);

  /**
   * Week-strip cell pitch, from `styles.calendarDay` (44) plus the
   * `calendarScroll` gap (2). The reference hard-codes 52 here, which drifts
   * ~6pt per cell and leaves today well off-centre by the end of the window;
   * deriving the pitch from the real geometry is the one place this screen
   * deliberately departs from the reference's literal numbers.
   */
  const DAY_PITCH = 46;
  const centerOffsetFor = useCallback(
    (index: number) => Math.max(0, index * DAY_PITCH - screenWidth / 2 + DAY_PITCH / 2),
    [screenWidth],
  );

  const selectedDateKey = formatDateKey(selectedDate);
  const todayKey = formatDateKey(new Date());
  const sortedDateKeys = useMemo(() => Object.keys(schedule).sort(), [schedule]);

  const handleLoadPress = useCallback(
    (shipmentId: string) => {
      router.push({ pathname: "/load/[id]", params: { id: shipmentId } });
    },
    [router],
  );

  const scrollToDateKey = useCallback((dateKey: string) => {
    const positions = sectionYPositions.current;
    let y = positions[dateKey];
    if (y == null) {
      const keys = Object.keys(positions).sort();
      const upcoming = keys.find((k) => k >= dateKey);
      const past = [...keys].reverse().find((k) => k < dateKey);
      const fallback = upcoming ?? past;
      if (fallback != null) y = positions[fallback];
    }
    if (y != null) listScrollRef.current?.scrollTo({ y, animated: false });
  }, []);

  const goToToday = useCallback(() => {
    const today = new Date();
    setSelectedDate(today);
    const key = formatDateKey(today);
    const todayIdx = weekDates.findIndex((d) => isToday(d));
    if (todayIdx >= 0) {
      calendarScrollRef.current?.scrollTo({ x: centerOffsetFor(todayIdx), animated: true });
    }
    requestAnimationFrame(() => requestAnimationFrame(() => scrollToDateKey(key)));
  }, [centerOffsetFor, scrollToDateKey, weekDates]);

  const handleListScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const todayY = sectionYPositions.current[todayKey];
      if (todayY != null) setTodayIsAbove(y > todayY + 50);
    },
    [todayKey],
  );

  const handleSectionLayout = useCallback(
    (dateKey: string, e: LayoutChangeEvent) => {
      // React Native may recycle the synthetic event before the animation
      // frame runs, so retain the primitive rather than closing over `e`.
      const layoutY = e.nativeEvent.layout.y;
      sectionYPositions.current[dateKey] = layoutY;
      if (dateKey === todayKey && !hasAutoScrolled.current) {
        requestAnimationFrame(() => {
          listScrollRef.current?.scrollTo({ y: layoutY, animated: false });
          hasAutoScrolled.current = true;
        });
      }
    },
    [todayKey],
  );

  useEffect(() => {
    if (!weekDates.length) return;
    const todayIdx = weekDates.findIndex((d) => isToday(d));
    if (todayIdx < 0) return;
    const scrollX = centerOffsetFor(todayIdx);
    const timer = setTimeout(() => {
      calendarScrollRef.current?.scrollTo({ x: scrollX, animated: false });
    }, 100);
    return () => clearTimeout(timer);
  }, [centerOffsetFor, weekDates]);

  const DAY_WINDOW = 30;
  const centerIdx = DAY_WINDOW;
  const dayDates = useMemo(
    () => Array.from({ length: DAY_WINDOW * 2 + 1 }, (_, i) => addDays(selectedDate, i - DAY_WINDOW)),
    [selectedDate],
  );

  const onDaySwipe = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (isScrollingProgrammatically.current) return;
      const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
      const offset = idx - centerIdx;
      if (offset === 0) return;
      isScrollingProgrammatically.current = true;
      setSelectedDate((prev) => addDays(prev, offset));
      setTimeout(() => {
        isScrollingProgrammatically.current = false;
      }, 300);
    },
    [centerIdx, screenWidth],
  );

  useEffect(() => {
    if (viewMode !== "day") return;
    const timer = setTimeout(() => {
      try {
        dayFlatRef.current?.scrollToIndex({ index: centerIdx, animated: false });
      } catch {
        // scrollToIndex throws until the row is measured; the next render retries.
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [centerIdx, selectedDate, viewMode]);

  const allDriverIds = useMemo(() => drivers.map((d) => d.id), [drivers]);

  return (
    <View style={styles.container}>
      <Header
        leftAction={
          <Pressable
            accessibilityLabel="Calendar view options"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setFilterVisible(true)}
            style={styles.headerBtn}
          >
            <Feather color={THEME.text} name="menu" size={20} />
          </Pressable>
        }
        rightAction={
          <View style={styles.headerActions}>
            <Pressable
              accessibilityLabel="Jump to today"
              accessibilityRole="button"
              hitSlop={8}
              onPress={goToToday}
              style={styles.headerAddBtn}
            >
              <Feather color={THEME.primary} name="calendar" size={18} />
            </Pressable>
          </View>
        }
        title="Schedule"
      />

      <View style={styles.calendarStrip}>
        <ScrollView
          contentContainerStyle={styles.calendarScroll}
          horizontal
          ref={calendarScrollRef}
          showsHorizontalScrollIndicator={false}
        >
          {weekDates.map((d) => {
            const dateKey = formatDateKey(d);
            const isSelected = dateKey === selectedDateKey;
            const isTodayDate = isToday(d);
            const hasEvents = !!schedule[dateKey]?.length;
            return (
              <Pressable
                accessibilityLabel={dateKey}
                accessibilityRole="button"
                key={dateKey}
                onPress={() => {
                  setSelectedDate(d);
                  if (viewMode === "list") setTimeout(() => scrollToDateKey(dateKey), 200);
                }}
                style={[styles.calendarDay, isSelected && styles.calendarDaySelected]}
              >
                <Text
                  style={[styles.calendarDayLabel, isSelected && styles.calendarDayLabelSelected]}
                >
                  {DAYS[d.getUTCDay()]}
                </Text>
                <View
                  style={[
                    styles.calendarDayNum,
                    isSelected && styles.calendarDayNumSelected,
                    isTodayDate && !isSelected && styles.calendarDayNumToday,
                  ]}
                >
                  <Text
                    style={[
                      styles.calendarDayNumText,
                      isSelected && styles.calendarDayNumTextSelected,
                      isTodayDate && !isSelected && styles.calendarDayNumTextToday,
                    ]}
                  >
                    {d.getUTCDate()}
                  </Text>
                </View>
                {hasEvents && !isSelected ? <View style={styles.calendarDot} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {isAdmin && drivers.length > 0 ? (
        <View style={styles.techFilterRow}>
          <DriverFilter drivers={drivers} onToggle={toggleDriver} selected={selectedDriverIds} />
        </View>
      ) : null}

      <View style={styles.viewToggle}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setViewMode("list")}
          style={[styles.viewToggleBtn, viewMode === "list" && styles.viewToggleBtnActive]}
        >
          <Feather
            color={viewMode === "list" ? THEME.text : THEME.textMuted}
            name="list"
            size={14}
          />
          <Text style={[styles.viewToggleText, viewMode === "list" && styles.viewToggleTextActive]}>
            List
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setViewMode("day")}
          style={[styles.viewToggleBtn, viewMode === "day" && styles.viewToggleBtnActive]}
        >
          <Feather
            color={viewMode === "day" ? THEME.text : THEME.textMuted}
            name="columns"
            size={14}
          />
          <Text style={[styles.viewToggleText, viewMode === "day" && styles.viewToggleTextActive]}>
            Day
          </Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={THEME.primary} size="large" />
        </View>
      ) : viewMode === "list" ? (
        <ScrollView
          onScroll={handleListScroll}
          ref={listScrollRef}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          style={styles.listScroll}
        >
          {sortedDateKeys.length === 0 ? (
            <View style={styles.emptyListWrap}>
              <Feather color={THEME.textMuted} name="calendar" size={40} />
              <Text style={styles.emptyListTitle}>No loads scheduled</Text>
              <Text style={styles.emptyListSub}>Nothing falls in this range for the current filter</Text>
            </View>
          ) : (
            sortedDateKeys.map((dateKey) => (
              <View
                key={dateKey}
                onLayout={(e) => handleSectionLayout(dateKey, e)}
                style={styles.dateSection}
              >
                <View
                  style={[
                    styles.dateSectionHeader,
                    dateKey === todayKey && styles.dateSectionHeaderToday,
                  ]}
                >
                  <Text
                    style={[
                      styles.dateSectionTitle,
                      dateKey === todayKey && styles.dateSectionTitleToday,
                    ]}
                  >
                    {formatDayHeader(dateKey)}
                  </Text>
                </View>
                {schedule[dateKey].map((shipment) => (
                  <LoadCard
                    customer={customersById[shipment.customerId]}
                    driverColors={driverColors}
                    drivers={drivers}
                    hasException={exceptionShipmentIds.has(shipment.id)}
                    key={shipment.id}
                    onCustomerPress={() => handleLoadPress(shipment.id)}
                    onPress={() => handleLoadPress(shipment.id)}
                    shipment={shipment}
                  />
                ))}
              </View>
            ))
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      ) : (
        <FlatList
          data={dayDates}
          getItemLayout={(_, index) => ({
            length: screenWidth,
            offset: screenWidth * index,
            index,
          })}
          horizontal
          initialScrollIndex={centerIdx}
          keyExtractor={(d) => formatDateKey(d)}
          onMomentumScrollEnd={onDaySwipe}
          onScrollToIndexFailed={() => undefined}
          pagingEnabled
          ref={dayFlatRef}
          renderItem={({ item: dayDate }) => (
            <ScrollView
              contentContainerStyle={{ paddingBottom: 100 }}
              showsVerticalScrollIndicator={false}
              style={{ width: screenWidth }}
            >
              <DayTimeline
                customersById={customersById}
                driverColors={driverColors}
                drivers={drivers}
                onPress={handleLoadPress}
                shipments={schedule[formatDateKey(dayDate)] ?? []}
              />
            </ScrollView>
          )}
          showsHorizontalScrollIndicator={false}
        />
      )}

      <Modal animationType="slide" onRequestClose={() => setFilterVisible(false)} transparent visible={filterVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Calendar view</Text>
              <Pressable
                accessibilityLabel="Close calendar view options"
                accessibilityRole="button"
                hitSlop={12}
                onPress={() => setFilterVisible(false)}
              >
                <Feather color={THEME.text} name="x" size={22} />
              </Pressable>
            </View>

            <Text style={styles.filterSectionLabel}>View mode</Text>
            <Pressable accessibilityRole="button" onPress={() => setViewMode("list")} style={styles.filterRow}>
              <Feather color={viewMode === "list" ? THEME.primary : THEME.textSecondary} name="list" size={18} />
              <Text style={[styles.filterRowText, viewMode === "list" && styles.filterRowTextActive]}>
                List view
              </Text>
              {viewMode === "list" ? <Feather color={THEME.primary} name="check" size={16} /> : null}
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setViewMode("day")} style={styles.filterRow}>
              <Feather color={viewMode === "day" ? THEME.primary : THEME.textSecondary} name="columns" size={18} />
              <Text style={[styles.filterRowText, viewMode === "day" && styles.filterRowTextActive]}>
                Day view
              </Text>
              {viewMode === "day" ? <Feather color={THEME.primary} name="check" size={16} /> : null}
            </Pressable>

            {isAdmin && drivers.length > 0 ? (
              <>
                <Text style={[styles.filterSectionLabel, { marginTop: 24 }]}>Drivers</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => toggleSelectAll(allDriverIds)}
                  style={styles.filterRow}
                >
                  <View
                    style={[
                      styles.filterCheckbox,
                      selectedDriverIds.length === 0 && styles.filterCheckboxActive,
                    ]}
                  >
                    {selectedDriverIds.length === 0 ? (
                      <Feather color="#FFF" name="check" size={12} />
                    ) : null}
                  </View>
                  <Text style={styles.filterRowText}>Select all</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => toggleDriver("unassigned")}
                  style={styles.filterRow}
                >
                  <View
                    style={[
                      styles.filterCheckbox,
                      styles.filterCheckboxBlack,
                      selectedDriverIds.includes("unassigned") && styles.filterCheckboxActive,
                    ]}
                  >
                    {selectedDriverIds.includes("unassigned") || selectedDriverIds.length === 0 ? (
                      <Feather color="#FFF" name="check" size={12} />
                    ) : null}
                  </View>
                  <Text style={styles.filterRowText}>Unassigned</Text>
                </Pressable>

                {drivers.map((driver) => {
                  const isChecked =
                    selectedDriverIds.length === 0 || selectedDriverIds.includes(driver.id);
                  const color = driverColors[driver.id] ?? THEME.primary;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={driver.id}
                      onPress={() => toggleDriver(driver.id)}
                      style={styles.filterRow}
                    >
                      <View
                        style={[
                          styles.filterCheckbox,
                          { borderColor: color, backgroundColor: isChecked ? color : "transparent" },
                        ]}
                      >
                        {isChecked ? <Feather color="#FFF" name="check" size={12} /> : null}
                      </View>
                      <Text style={styles.filterRowText}>
                        {[driver.firstName, driver.lastName].filter(Boolean).join(" ")}
                      </Text>
                    </Pressable>
                  );
                })}
              </>
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={() => setFilterVisible(false)}
              style={styles.modalDoneBtn}
            >
              <Text style={styles.modalDoneBtnText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {viewMode === "list" ? (
        <View style={styles.floatingTodayWrap}>
          <Pressable accessibilityRole="button" onPress={goToToday} style={styles.floatingTodayBtn}>
            <Feather
              color="#FFF"
              name={todayIsAbove ? "chevron-up" : "chevron-down"}
              size={14}
              style={{ marginRight: 4 }}
            />
            <Text style={styles.floatingTodayText}>Today</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
