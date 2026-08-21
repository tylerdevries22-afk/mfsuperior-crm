import Feather from "@expo/vector-icons/Feather";
import { useRouter, type Href } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { RADIUS, RADIUS_DENSE, SPACE, TYPO, useTheme } from "@/theme";

import { FreightBackHeader, FreightStatusPill, toneColor } from "./FreightChrome";
import type { FreightMarketplaceSpec, FreightRecord } from "./types";

const artwork: Readonly<Record<FreightMarketplaceSpec["art"], ImageSourcePropType>> = {
  capacity: require("@/assets/freight/capacity-warehouse.webp") as ImageSourcePropType,
  equipment: require("@/assets/freight/equipment-categories.webp") as ImageSourcePropType,
};

function Listing({ record }: { readonly record: FreightRecord }) {
  const router = useRouter();
  const theme = useTheme();
  return <Pressable accessibilityRole="button" onPress={() => record.route && router.push(record.route as Href)} style={({ pressed }) => [styles.listing, { backgroundColor: theme.surface, borderColor: theme.border }, pressed && styles.pressed]}><View style={[styles.listingIcon, { backgroundColor: `${toneColor(theme, record.tone ?? "brand")}18` }]}><Feather color={toneColor(theme, record.tone ?? "brand")} name={record.icon ?? "truck"} size={22} /></View><View style={styles.listingCopy}><Text style={[styles.listingTitle, { color: theme.text }]}>{record.title}</Text><Text numberOfLines={2} style={[styles.listingSubtitle, { color: theme.textSecondary }]}>{record.subtitle}</Text>{record.meta ? <Text style={[styles.listingMeta, { color: theme.textMuted }]}>{record.meta}</Text> : null}</View>{record.status ? <FreightStatusPill label={record.status} tone={record.tone} /> : <Feather color={theme.textMuted} name="chevron-right" size={18} />}</Pressable>;
}

export function FreightMarketplaceScreen({ spec }: { readonly spec: FreightMarketplaceSpec }) {
  const router = useRouter();
  const theme = useTheme();
  return <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: theme.background }]}><FreightBackHeader title={spec.title} trailing={<Pressable accessibilityLabel="Open request cart" accessibilityRole="button" onPress={() => router.push(spec.cartRoute as Href)} style={[styles.cart, { backgroundColor: theme.surfaceElevated }]}><Feather color={theme.text} name="shopping-bag" size={19} /></Pressable>} /><ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false}><View style={[styles.hero, { backgroundColor: theme.surface, borderColor: theme.border }]}><Image source={artwork[spec.art]} style={styles.art} /><View style={styles.overlay} /><View style={styles.heroCopy}><Text style={[styles.eyebrow, { color: theme.primaryLight }]}>{spec.eyebrow}</Text><Text style={[styles.title, { color: theme.text }]}>{spec.title}</Text><Text style={[styles.description, { color: theme.textSecondary }]}>{spec.description}</Text><Pressable accessibilityRole="search" onPress={() => router.push(spec.searchRoute as Href)} style={[styles.search, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}><Feather color={theme.textMuted} name="search" size={18} /><Text style={[styles.searchText, { color: theme.textMuted }]}>Search availability, lanes, or units</Text></Pressable></View></View><Text style={[styles.sectionTitle, { color: theme.text }]}>Browse categories</Text><ScrollView horizontal contentContainerStyle={styles.categories} showsHorizontalScrollIndicator={false}>{spec.categories.map((category) => <Pressable accessibilityRole="button" key={category.id} onPress={() => category.route && router.push(category.route as Href)} style={({ pressed }) => [styles.category, { backgroundColor: theme.surface, borderColor: theme.border }, pressed && styles.pressed]}><View style={[styles.categoryIcon, { backgroundColor: theme.primaryMuted }]}><Feather color={theme.primaryLight} name={category.icon ?? "grid"} size={21} /></View><Text style={[styles.categoryTitle, { color: theme.text }]}>{category.title}</Text><Text numberOfLines={2} style={[styles.categoryMeta, { color: theme.textMuted }]}>{category.subtitle}</Text></Pressable>)}</ScrollView><Text style={[styles.sectionTitle, { color: theme.text }]}>Featured now</Text><View style={styles.listings}>{spec.featured.map((record) => <Listing key={record.id} record={record} />)}</View></ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  art: { height: "100%", opacity: 0.54, position: "absolute", right: -32, width: 246 },
  cart: { alignItems: "center", borderRadius: 22, height: 44, justifyContent: "center", width: 44 },
  categories: { gap: SPACE.sm, paddingRight: 20 },
  category: { borderRadius: RADIUS.lg, borderWidth: 1, gap: 7, minHeight: 142, padding: 15, width: 132 },
  categoryIcon: { alignItems: "center", borderRadius: RADIUS_DENSE.xl, height: 42, justifyContent: "center", width: 42 },
  categoryMeta: { ...TYPO.subtitle },
  categoryTitle: { ...TYPO.captionStrong },
  content: { gap: SPACE.lg, paddingBottom: SPACE.xxl, paddingHorizontal: 20, paddingTop: SPACE.lg },
  description: { ...TYPO.caption, maxWidth: 245 },
  eyebrow: { ...TYPO.eyebrow },
  hero: { borderRadius: RADIUS.xl, borderWidth: 1, minHeight: 330, overflow: "hidden" },
  heroCopy: { flex: 1, gap: SPACE.md, justifyContent: "flex-end", padding: 22 },
  listing: { alignItems: "center", borderRadius: RADIUS.lg, borderWidth: 1, flexDirection: "row", gap: 12, minHeight: 92, padding: 14 },
  listingCopy: { flex: 1, gap: 2, minWidth: 0 },
  listingIcon: { alignItems: "center", borderRadius: RADIUS_DENSE.xl, height: 48, justifyContent: "center", width: 48 },
  listingMeta: { ...TYPO.subtitle, marginTop: 2 },
  listings: { gap: SPACE.sm },
  listingSubtitle: { ...TYPO.caption },
  listingTitle: { ...TYPO.rowTitle },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(8,10,7,0.38)" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  safe: { flex: 1 },
  search: { alignItems: "center", borderRadius: RADIUS.md, borderWidth: 1, flexDirection: "row", gap: 10, minHeight: 50, paddingHorizontal: 14 },
  searchText: { ...TYPO.caption, flex: 1 },
  sectionTitle: { ...TYPO.heading },
  title: { ...TYPO.largeTitle, maxWidth: 270 },
});
