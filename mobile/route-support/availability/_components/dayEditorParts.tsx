import type {
  AvailabilityBlock,
  AvailabilityBlockInput,
  AvailabilityKind,
  AvailabilityRuleInput,
  Shipment,
} from "@/domain/types";
import { FONTS, RADIUS, RADIUS_DENSE, SPACE, TYPO } from "@/theme";
import Feather from "@expo/vector-icons/Feather";
import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  blockList: { borderRadius: RADIUS.md, borderWidth: 1, overflow: "hidden" },
  blockMeta: { ...TYPO.caption, marginTop: 2 },
  blockRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACE.sm,
    minHeight: 56,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
  },
  blockTitle: { ...TYPO.rowTitle },
  conflict: {
    alignItems: "flex-start",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACE.sm,
    padding: SPACE.md,
  },
  conflictBody: { ...TYPO.caption, marginTop: 2 },
  conflictTitle: { ...TYPO.captionStrong },
  content: { gap: SPACE.md, paddingBottom: SPACE.md },
  grow: { flex: 1, minWidth: 0 },
  kindChip: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.xs,
  },
  kindLabel: { ...TYPO.caption, fontFamily: FONTS.medium },
  kindRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.xs },
  label: { ...TYPO.label },
  quickChip: {
    alignItems: "center",
    borderRadius: RADIUS_DENSE.lg,
    borderWidth: 1,
    flexBasis: "31%",
    flexGrow: 1,
    gap: SPACE.xs,
    justifyContent: "center",
    minHeight: 76,
    paddingHorizontal: SPACE.xs,
    paddingVertical: SPACE.sm,
  },
  quickLabel: { ...TYPO.subtitle, textAlign: "center" },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.xs },
  removeButton: { alignItems: "center", height: 44, justifyContent: "center", width: 44 },
});

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const QUICK_ACTIONS: readonly {
  readonly kind: AvailabilityKind;
  readonly label: string;
  readonly icon: keyof typeof Feather.glyphMap;
}[] = [
    { icon: "check-circle", kind: "available", label: "Available all day" },
    { icon: "slash", kind: "unavailable", label: "Unavailable all day" },
    { icon: "sun", kind: "time_off", label: "Time off" },
  ];

export const KIND_LABELS: Record<AvailabilityKind, string> = {
  available: "Available",
  preferred: "Preferred",
  time_off: "Time off",
  unavailable: "Unavailable",
};

export interface DayEditorSheetProps {
  readonly dateKey: string | null;
  readonly blocks: readonly AvailabilityBlock[];
  readonly conflicts: readonly Shipment[];
  readonly busy: boolean;
  readonly onClose: () => void;
  readonly onSaveBlock: (input: AvailabilityBlockInput) => void;
  readonly onSaveRule: (input: AvailabilityRuleInput) => void;
  readonly onRemoveBlock: (blockId: string) => void;
  /** Called as the drag settles, so the screen owns the haptic policy. */
  readonly onDragSettle?: () => void;
}
