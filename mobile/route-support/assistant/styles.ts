import { StyleSheet } from "react-native";

import { FONTS, RADIUS_LEGACY as RADIUS, SPACING, THEME } from "@/theme";

/**
 * Ported verbatim from the Appliance Diagnostic Systems assistant at
 * 480991b7eb0036e4e85c37d3784b2de2ca97d10d, changing only the token import.
 * Names that mention appliances or diagnosis are the reference's; the freight
 * assistant fills the same slots.
 */

export const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: THEME.border,
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontFamily: FONTS.bold, fontSize: 18, color: THEME.text, letterSpacing: 0.3 },
  headerLive: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: THEME.primary },
  liveText: { fontFamily: FONTS.regular, fontSize: 11, color: THEME.textSecondary },
  menuBtn: { padding: 4, width: 40 },
  newChatBtn: { padding: 4, width: 40, alignItems: "flex-end" },
  body: { flex: 1 },
  welcomeWrap: { flex: 1, justifyContent: "flex-end" },
  logoSection: { flex: 1, alignItems: "center", justifyContent: "center" },
  welcomeTitle: { fontFamily: FONTS.bold, fontSize: 26, color: THEME.text, marginTop: 16, letterSpacing: -0.3 },
  welcomeSub: { fontFamily: FONTS.regular, fontSize: 15, color: THEME.textSecondary, marginTop: 6 },
  quickActions: { paddingBottom: 8 },
  quickScroll: { paddingHorizontal: 16, gap: 10 },
  quickCard: {
    backgroundColor: THEME.surface, borderRadius: RADIUS.lg, borderWidth: 1,
    borderColor: THEME.border, paddingHorizontal: 16, paddingVertical: 14, width: 140,
  },
  quickCardActive: { backgroundColor: `${THEME.primary}12`, borderColor: `${THEME.primary}60` },
  quickLabel: { fontFamily: FONTS.medium, fontSize: 13, color: THEME.text, lineHeight: 18 },
  quickLabelActive: { color: THEME.primary },
  subActionsPanel: {
    marginHorizontal: 16, marginTop: 10, backgroundColor: THEME.surface,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: `${THEME.primary}30`,
    overflow: "hidden", maxHeight: 240,
  },
  subActionsHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: THEME.border,
  },
  subActionsHeaderText: {
    fontFamily: FONTS.semibold, fontSize: 12, color: THEME.primary,
    letterSpacing: 0.4, textTransform: "uppercase",
  },
  subActionsScrollV: { flex: 1 },
  subActionsGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 10, paddingVertical: 10, gap: 6 },
  subActionCell: {
    width: "30.5%", backgroundColor: THEME.surfaceElevated, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: THEME.border, paddingHorizontal: 8, paddingVertical: 8,
    alignItems: "center", gap: 4,
  },
  subActionCellPrompt: { borderColor: `${THEME.textMuted}30`, backgroundColor: THEME.background },
  subActionCellText: { fontFamily: FONTS.medium, fontSize: 10.5, color: THEME.text, textAlign: "center", lineHeight: 13 },
  subActionCellTextPrompt: { color: THEME.textSecondary },
  subActionCellActive: { backgroundColor: `${THEME.primary}15`, borderColor: `${THEME.primary}40` },
  subActionCellTextActive: { color: THEME.primary },
  diagCarouselContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 10, alignItems: "center" },
  diagApplianceCard: {
    width: 90, alignItems: "center", backgroundColor: THEME.surfaceElevated, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: THEME.border, paddingVertical: 12, paddingHorizontal: 8, gap: 8,
  },
  diagApplianceImage: { width: 56, height: 56 },
  diagApplianceLabel: { fontFamily: FONTS.medium, fontSize: 11, color: THEME.text, textAlign: "center", lineHeight: 14 },
  diagBrandCard: {
    width: 80, alignItems: "center", backgroundColor: THEME.surfaceElevated, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: THEME.border, paddingVertical: 12, paddingHorizontal: 8, gap: 6,
  },
  diagBrandLabel: { fontFamily: FONTS.medium, fontSize: 10, color: THEME.textSecondary, textAlign: "center" },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  chatList: { paddingTop: 16, paddingBottom: 8 },
  toolStatusRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  toolStatusAvatar: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: THEME.surfaceElevated,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: THEME.border,
  },
  bottomBar: { flexShrink: 0, flexGrow: 0, borderTopWidth: 1, borderTopColor: THEME.border, backgroundColor: THEME.background, paddingHorizontal: 12, paddingTop: 8 },
  suggestionsBar: {},
  suggestionsScroll: { marginHorizontal: -12, paddingHorizontal: 12, paddingBottom: 8, gap: 8, alignItems: "center" as const },
  suggestionPill: {
    backgroundColor: THEME.surface, borderRadius: 20, borderWidth: 1,
    borderColor: THEME.primary + "50", paddingHorizontal: 16, paddingVertical: 9,
  },
  suggestionText: { fontFamily: FONTS.medium, fontSize: 13, color: THEME.primary, lineHeight: 17 },
  imagePreviewRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 4, marginBottom: 4 },
  imagePreviewThumb: { width: 44, height: 44, borderRadius: 8, backgroundColor: THEME.surfaceElevated },
  imagePreviewLabel: { flex: 1, fontFamily: FONTS.regular, fontSize: 13, color: THEME.textSecondary },
  inputRow: {
    flexDirection: "row", alignItems: "flex-end", backgroundColor: THEME.surface,
    borderRadius: RADIUS.xxl, borderWidth: 1, borderColor: THEME.border, paddingHorizontal: 6, paddingVertical: 6, gap: 2,
  },
  inputIconBtn: { padding: 6, alignSelf: "flex-end" },
  textInput: { flex: 1, fontFamily: FONTS.regular, fontSize: 15, color: THEME.text, maxHeight: 120, paddingHorizontal: 6, paddingVertical: 4, lineHeight: 20 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: THEME.primary, alignItems: "center", justifyContent: "center", alignSelf: "flex-end" },
  sendBtnDisabled: { backgroundColor: THEME.surfaceBright },
  micSparkle: { position: "absolute", top: -6, right: -4, fontSize: 9, color: THEME.primary, fontFamily: FONTS.bold },
  pillInputArea: { flex: 1, flexDirection: "row", alignItems: "center", flexWrap: "nowrap", overflow: "hidden" },
  inputPill: {
    flexDirection: "row", alignItems: "center", backgroundColor: `${THEME.primary}20`,
    borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1, borderColor: `${THEME.primary}50`,
  },
  inputPillTech: { backgroundColor: `${THEME.success}18`, borderColor: `${THEME.success}50` },
  inputPillAction: { backgroundColor: `${THEME.primary}10`, borderColor: `${THEME.primary}35` },
  inputPillText: { fontFamily: FONTS.semibold, fontSize: 12, color: THEME.primary },
  inputPillTextTech: { color: THEME.success },
  techToggleRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: THEME.border, marginBottom: 2,
  },
  techToggleLabel: { fontFamily: FONTS.medium, fontSize: 11, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: 0.4, flexShrink: 0 },
  techToggleBadges: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  techBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: THEME.surfaceBright, borderWidth: 1, borderColor: THEME.border },
  techBadgeSelected: { backgroundColor: `${THEME.success}20`, borderColor: `${THEME.success}60` },
  techBadgeText: { fontFamily: FONTS.medium, fontSize: 12, color: THEME.textSecondary },
  techBadgeTextSelected: { color: THEME.success },
});

export const diagSt = StyleSheet.create({
  startingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", zIndex: 999 },
  startingCard: {
    backgroundColor: THEME.surface, borderRadius: RADIUS.xl,
    paddingHorizontal: 32, paddingVertical: 28, alignItems: "center", gap: 16, borderWidth: 1, borderColor: THEME.border,
  },
  startingText: { fontFamily: FONTS.semibold, fontSize: 15, color: THEME.text },
});

export const jcSt = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: { backgroundColor: THEME.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 40, paddingTop: 12, maxHeight: "80%" },
  sheetTall: { height: "82%" },
  handle: { width: 36, height: 4, backgroundColor: THEME.border, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  sheetTitle: { fontFamily: FONTS.bold, fontSize: 19, color: THEME.text, marginBottom: 4 },
  sheetSub: { fontFamily: FONTS.regular, fontSize: 13, color: THEME.textSecondary, marginBottom: 20 },
  contextCard: { flexDirection: "row", alignItems: "center", backgroundColor: THEME.background, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: THEME.primary + "55", padding: 14, marginBottom: 10, gap: 12 },
  contextCardOff: { borderColor: THEME.border, opacity: 0.7 },
  contextCardCheck: { width: 22 },
  contextCardBody: { flex: 1 },
  contextCardLabel: { fontFamily: FONTS.semibold, fontSize: 11, color: THEME.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  contextCardValue: { fontFamily: FONTS.regular, fontSize: 14, color: THEME.text },
  requiredBadge: { fontFamily: FONTS.semibold, fontSize: 10, color: THEME.primary, backgroundColor: THEME.primary + "18", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, overflow: "hidden" },
  startBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: THEME.primary, borderRadius: RADIUS.xl, paddingVertical: 14, gap: 8, marginTop: 16 },
  startBtnText: { fontFamily: FONTS.semibold, fontSize: 16, color: "#FFF" },
  voiceBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 13, gap: 6, marginTop: 6 },
  voiceBtnText: { fontFamily: FONTS.regular, fontSize: 14, color: THEME.primary },
  cancelBtn: { alignItems: "center", paddingVertical: 10 },
  cancelBtnText: { fontFamily: FONTS.regular, fontSize: 14, color: THEME.textMuted },
});

export const spSt = StyleSheet.create({
  sessionCard: { backgroundColor: THEME.background, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: THEME.border, padding: 14, marginBottom: 10 },
  sessionCardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  sessionTitle: { fontFamily: FONTS.semibold, fontSize: 14, color: THEME.text, marginBottom: 2 },
  sessionDate: { fontFamily: FONTS.regular, fontSize: 11, color: THEME.textMuted },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: "flex-start" },
  statusDiagnosed: { backgroundColor: "#0d948818" },
  statusInProgress: { backgroundColor: "#f59e0b18" },
  statusOther: { backgroundColor: THEME.border },
  statusText: { fontFamily: FONTS.semibold, fontSize: 10, color: THEME.primary },
  rootCauseRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: THEME.surface, borderRadius: RADIUS.md, padding: 10, marginBottom: 10 },
  rootCauseText: { flex: 1, fontFamily: FONTS.regular, fontSize: 12, color: THEME.textSecondary, lineHeight: 17 },
  confidenceBadge: { fontFamily: FONTS.semibold, fontSize: 10, color: THEME.primary, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: THEME.primary + "15", borderRadius: 10, overflow: "hidden", alignSelf: "flex-start", marginLeft: 4 },
  sessionActions: { flexDirection: "row", gap: 8 },
  viewBtn: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: THEME.border },
  viewBtnText: { fontFamily: FONTS.semibold, fontSize: 13, color: THEME.textSecondary },
  followUpBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 9, borderRadius: RADIUS.lg, backgroundColor: THEME.primary, gap: 5 },
  followUpBtnText: { fontFamily: FONTS.semibold, fontSize: 13, color: "#FFF" },
  resumeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 9, borderRadius: RADIUS.lg, backgroundColor: THEME.primary, gap: 5 },
  resumeBtnText: { fontFamily: FONTS.semibold, fontSize: 13, color: "#FFF" },
});
