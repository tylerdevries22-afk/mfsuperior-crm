import { StyleSheet } from "react-native";

import { FONTS, SPACING, THEME } from "@/theme";

/** The shared bottom-sheet option picker and the customer avatar it renders. */
export const pickerStyles = StyleSheet.create({
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  pickerSheet: {
    backgroundColor: THEME.surface,
    borderRadius: 16,
    padding: 20,
    width: "92%",
    maxHeight: "60%",
    marginBottom: 20,
  },
  pickerTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: THEME.text,
    marginBottom: 12,
  },
  pickerOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  pickerOptionText: {
    fontFamily: FONTS.medium,
    fontSize: 15,
    color: THEME.text,
    flex: 1,
  },
  pickerOptionActive: {
    color: THEME.primary,
    fontFamily: FONTS.semibold,
  },
  customerAvatarCircle: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 100,
  },
  customerAvatarText: {
    color: "#FFF",
    fontFamily: FONTS.semibold,
  },
});
