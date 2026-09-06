import { FONTS, RADIUS_DENSE, SPACE, TYPO } from "@/theme";
import {
  StyleSheet
} from "react-native";

export const HANDLE_SIZE = 28;

export const TRACK_HEIGHT = 56;

export const HOUR_TICKS = [0, 6, 12, 18, 24];

export interface TimeRangeTrackProps {
  readonly startMinute: number;
  readonly endMinute: number;
  readonly onChange: (startMinute: number, endMinute: number) => void;
  /** Fires when a drag settles, so the caller can play feedback once. */
  readonly onSettle?: () => void;
  readonly disabled?: boolean;
  readonly accessibilityLabel?: string;
}

export type Grip = "start" | "end" | "span" | null;

export const styles = StyleSheet.create({
  handle: {
    borderRadius: HANDLE_SIZE / 2,
    height: HANDLE_SIZE,
    position: "absolute",
    top: (TRACK_HEIGHT - HANDLE_SIZE) / 2,
    width: HANDLE_SIZE,
  },
  readout: { ...TYPO.cardTitle, fontFamily: FONTS.bold },
  readoutDivider: { ...TYPO.caption },
  readoutRow: { alignItems: "center", flexDirection: "row", gap: SPACE.sm, justifyContent: "center" },
  scaleLabel: { ...TYPO.subtitle, fontSize: 10 },
  scaleRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 2 },
  span: {
    borderRadius: RADIUS_DENSE.md,
    borderWidth: 1,
    bottom: 8,
    position: "absolute",
    top: 8,
  },
  tick: { bottom: 0, position: "absolute", top: 0, width: 1 },
  track: {
    borderRadius: RADIUS_DENSE.lg,
    borderWidth: 1,
    height: TRACK_HEIGHT,
    justifyContent: "center",
    overflow: "hidden",
  },
  trackDisabled: { opacity: 0.5 },
  wrapper: { gap: SPACE.sm },
});
