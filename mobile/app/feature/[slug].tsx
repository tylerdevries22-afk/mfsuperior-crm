import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  Badge,
  BottomSheet,
  Button,
  Card,
  EmptyState,
  Header,
  ListRow,
  Screen,
} from "@/components/ui";
import {
  canRoleOpenFeature,
  getFeatureDefinition,
  type FeatureItem,
} from "@/features/catalog";
import { useOperations } from "@/store";
import { SPACE, TYPO, useTheme } from "@/theme";

export default function FeatureScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ slug?: string | string[] }>();
  const theme = useTheme();
  const { currentAccount, effectiveRole } = useOperations();
  const [selected, setSelected] = useState<FeatureItem | null>(null);
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const feature = useMemo(() => getFeatureDefinition(slug ?? ""), [slug]);

  if (!feature) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]}>
        <Header centered onBack={() => router.back()} showBack title="Not found" />
        <Screen safeEdges={["left", "right", "bottom"]}>
          <EmptyState
            actionLabel="Return home"
            description="This freight workspace is not part of the prototype catalog."
            onAction={() => router.replace("/(tabs)")}
            title="Workspace unavailable"
          />
        </Screen>
      </View>
    );
  }

  const role = effectiveRole ?? currentAccount?.role ?? "customer";

  if (!canRoleOpenFeature(role, feature)) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]}>
        <Header centered onBack={() => router.back()} showBack title={feature.title} />
        <Screen safeEdges={["left", "right", "bottom"]}>
          <EmptyState
            actionLabel="Return home"
            description={`The ${feature.title.toLowerCase()} workspace is not available to the ${role} demo role.`}
            onAction={() => router.replace("/(tabs)")}
            title="Role access required"
          />
        </Screen>
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Header centered onBack={() => router.back()} showBack title={feature.title} />
      <Screen safeEdges={["left", "right", "bottom"]} scroll contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <Text style={[styles.eyebrow, { color: theme.primaryLight }]}>{feature.eyebrow}</Text>
          <Text style={[styles.title, { color: theme.text }]}>{feature.title}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{feature.subtitle}</Text>
        </View>

        {feature.simulationNotice ? (
          <Card>
            <View style={styles.notice}>
              <Ionicons color={theme.warning} name="information-circle-outline" size={20} />
              <Text style={[styles.noticeText, { color: theme.textSecondary }]}>{feature.simulationNotice}</Text>
            </View>
          </Card>
        ) : null}

        <Card padding="none">
          {feature.items.map((item, index) => (
            <ListRow
              isLast={index === feature.items.length - 1}
              key={item.id}
              meta={item.meta}
              onPress={() => setSelected(item)}
              subtitle={item.subtitle}
              title={item.title}
              trailing={<Badge label={item.meta ?? "Open"} size="sm" tone={item.tone ?? "neutral"} />}
            />
          ))}
        </Card>
      </Screen>

      <BottomSheet
        footer={<Button fullWidth onPress={() => setSelected(null)} title="Done" />}
        onClose={() => setSelected(null)}
        title={selected?.title ?? "Details"}
        visible={selected !== null}
      >
        {selected ? (
          <View style={styles.sheetContent}>
            <Badge label={selected.meta ?? "Available"} tone={selected.tone ?? "neutral"} />
            <Text style={[styles.sheetBody, { color: theme.textSecondary }]}>{selected.subtitle}</Text>
            <Text style={[styles.sheetFootnote, { color: theme.textMuted }]}>This action updates only the locally persistent prototype state.</Text>
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: SPACE.md },
  eyebrow: { ...TYPO.eyebrow },
  fill: { flex: 1 },
  intro: { gap: SPACE.sm, paddingVertical: SPACE.sm },
  notice: { alignItems: "flex-start", flexDirection: "row", gap: SPACE.sm },
  noticeText: { ...TYPO.body, flex: 1 },
  sheetBody: { ...TYPO.body },
  sheetContent: { gap: SPACE.md },
  sheetFootnote: { ...TYPO.caption, lineHeight: 18 },
  subtitle: { ...TYPO.body, lineHeight: 23 },
  title: { ...TYPO.screenTitle },
});
