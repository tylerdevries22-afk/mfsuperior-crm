import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from "react-native";

import { FONTS, RADIUS_DENSE, SPACE, TYPO, useTheme } from "@/theme";
import { NotificationButton } from "@/components/notifications";

import type { FreightTone } from "./types";

const mark = require("@/assets/freight/customer-hero-truck.webp") as ImageSourcePropType;

export function FreightBackHeader({ title, trailing }: { readonly title: string; readonly trailing?: ReactNode }) {
  const router = useRouter();
  const theme = useTheme();
  return (
    <View style={[styles.header, { borderBottomColor: theme.border }]}> 
      <Pressable accessibilityLabel="Go back" accessibilityRole="button" hitSlop={8} onPress={() => router.back()} style={({ pressed }) => [styles.iconButton, { backgroundColor: theme.surfaceElevated }, pressed && styles.pressed]}>
        <Feather color={theme.text} name="chevron-left" size={20} />
      </Pressable>
      <Text numberOfLines={1} style={[styles.headerTitle, { color: theme.text }]}>{title}</Text>
      <View style={styles.trailing}>{trailing}<NotificationButton /></View>
    </View>
  );
}

export function FreightBrandHeader({ context }: { readonly context?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.brandHeader, { borderBottomColor: theme.border }]}> 
      <Image accessibilityIgnoresInvertColors source={mark} style={styles.mark} />
      <View style={styles.brandCopy}>
        <Text style={[styles.brand, { color: theme.text }]}>MF SUPERIOR</Text>
        <Text style={[styles.context, { color: theme.textMuted }]}>{context ?? "FREIGHT OPERATIONS"}</Text>
      </View>
      <NotificationButton />
    </View>
  );
}

export function FreightStatusPill({ label, tone = "neutral" }: { readonly label: string; readonly tone?: FreightTone }) {
  const theme = useTheme();
  const color = toneColor(theme, tone);
  return (
    <View style={[styles.pill, { backgroundColor: `${color}18`, borderColor: `${color}55` }]}> 
      <View style={[styles.pillDot, { backgroundColor: color }]} />
      <Text numberOfLines={1} style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

export function toneColor(theme: ReturnType<typeof useTheme>, tone: FreightTone): string {
  if (tone === "brand") return theme.primaryLight;
  if (tone === "success") return theme.success;
  if (tone === "warning") return theme.warning;
  if (tone === "danger") return theme.danger;
  if (tone === "info") return theme.info;
  return theme.textMuted;
}

const styles = StyleSheet.create({
  brand: { fontFamily: FONTS.bold, fontSize: 13, letterSpacing: 1.35, lineHeight: 17 },
  brandCopy: { flex: 1 },
  brandHeader: { alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: SPACE.sm, minHeight: 58, paddingHorizontal: 20 },
  context: { fontFamily: FONTS.semibold, fontSize: 9, letterSpacing: 1.1, lineHeight: 13 },
  header: { alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: SPACE.sm, minHeight: 58, paddingHorizontal: 16 },
  headerTitle: { ...TYPO.cardTitle, flex: 1, textAlign: "center" },
  iconButton: { alignItems: "center", borderRadius: 22, height: 44, justifyContent: "center", width: 44 },
  iconPlaceholder: { height: 44, width: 44 },
  mark: { borderRadius: RADIUS_DENSE.md, height: 34, width: 44 },
  network: { alignItems: "center", borderRadius: 13, borderWidth: 1, flexDirection: "row", gap: 5, minHeight: 26, paddingHorizontal: 9 },
  networkDot: { borderRadius: 3, height: 6, width: 6 },
  networkText: { fontFamily: FONTS.bold, fontSize: 9, letterSpacing: 0.8 },
  pill: { alignItems: "center", alignSelf: "flex-start", borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, minHeight: 28, paddingHorizontal: 10 },
  pillDot: { borderRadius: 3, height: 6, width: 6 },
  pillText: { fontFamily: FONTS.semibold, fontSize: 11, lineHeight: 15, textTransform: "capitalize" },
  pressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  trailing: { alignItems: "center", flexDirection: "row", gap: SPACE.xs },
});
