import { FONTS, THEME } from "@/theme";
import {
  StyleSheet
} from "react-native";

export const SNAP_POINTS = { collapsed: 0.08, half: 0.5, expanded: 0.92 } as const;

export const MIN_TOP_GAP = 8;

export const DRAG_HANDLE_HEIGHT = 28;

export const CORNER_RADIUS = 16;

export const MIN_DRAG_TO_SNAP = 20;

export const SPRING = { stiffness: 500, damping: 45, mass: 0.6 };

export type SheetPosition = keyof typeof SNAP_POINTS;

export function nearest(height: number, screenHeight: number, maxHeight: number): SheetPosition {
  const entries = Object.entries(SNAP_POINTS) as [SheetPosition, number][];
  const heightOf = (ratio: number) => Math.min(screenHeight * ratio, maxHeight);
  return entries.reduce(
    (best, [key, ratio]) =>
      Math.abs(heightOf(ratio) - height) < Math.abs(heightOf(SNAP_POINTS[best]) - height)
        ? key
        : best,
    "half" as SheetPosition,
  );
}

export function next(from: SheetPosition, direction: "up" | "down"): SheetPosition {
  const order: SheetPosition[] = ["collapsed", "half", "expanded"];
  const index = order.indexOf(from);
  const target = direction === "up" ? index + 1 : index - 1;
  return order[Math.max(0, Math.min(order.length - 1, target))];
}

export const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: 16 },
  bodyHidden: { opacity: 0 },
  handle: {
    backgroundColor: THEME.textMuted,
    borderRadius: 3,
    height: 5,
    opacity: 0.6,
    width: 44,
  },
  handleArea: {
    alignItems: "center",
    height: DRAG_HANDLE_HEIGHT,
    justifyContent: "center",
  },
  header: { paddingBottom: 8, paddingHorizontal: 16 },
  sheet: {
    backgroundColor: THEME.surface,
    borderColor: THEME.border,
    borderTopLeftRadius: CORNER_RADIUS,
    borderTopRightRadius: CORNER_RADIUS,
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
  },
  subtitle: { color: THEME.textSecondary, fontFamily: FONTS.regular, fontSize: 13, marginTop: 2 },
  title: { color: THEME.text, fontFamily: FONTS.bold, fontSize: 17 },
});
