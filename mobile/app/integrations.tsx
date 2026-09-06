import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Card, EmptyState, Header, ListRow, PartnerLogo, Screen, SectionHeader } from "@/components/ui";
import { FREIGHT_PARTNERS, type FreightPartnerDefinition } from "@/features/partner-integrations";
import { PartnerSheet } from "@/route-support/integrations/PartnerSheet";
import { useOperations } from "@/store";
import { ICON, RADIUS, SPACE, TYPO, useTheme } from "@/theme";

export default function IntegrationsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { effectiveRole } = useOperations();
  const [selected, setSelected] = useState<FreightPartnerDefinition | null>(null);

  const groups = useMemo(() => ({
    available: FREIGHT_PARTNERS.filter((partner) => partner.status === "portal_available"),
    credentials: FREIGHT_PARTNERS.filter((partner) => partner.status === "credentials_required"),
  }), []);

  if (effectiveRole !== "admin") {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]}>
        <Header onBack={() => router.back()} showBack title="Integrations" />
        <Screen safeEdges={["left", "right", "bottom"]}>
          <EmptyState
            icon={<Feather color={theme.textMuted} name="link" size={36} />}
            message="Carrier connections are an admin console. Switch to an admin account to open it."
            title="Admin role required"
          />
        </Screen>
      </View>
    );
  }

  const renderGroup = (partners: readonly FreightPartnerDefinition[]) => (
    <Card padding="none">
      {partners.map((partner, index) => (
        <ListRow
          accessibilityLabel={`${partner.name}, ${partner.statusLabel}`}
          isLast={index === partners.length - 1}
          key={partner.id}
          leading={<PartnerLogo label={partner.name} size="md" slug={partner.id} />}
          onPress={() => setSelected(partner)}
          subtitle={partner.statusLabel}
          title={partner.name}
          trailing={<Feather color={theme.textMuted} name="chevron-right" size={18} />}
        />
      ))}
    </Card>
  );

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Header
        centered
        onBack={() => router.back()}
        showBack
        subtitle={`${FREIGHT_PARTNERS.length} carrier connections`}
        title="Integrations"
      />
      <Screen contentContainerStyle={styles.content} safeEdges={["left", "right", "bottom"]} scroll>
        <View style={[styles.banner, { backgroundColor: theme.warningMuted, borderColor: theme.tint.warning.medium }]}>
          <Feather color={theme.warning} name="lock" size={ICON.md} />
          <View style={styles.grow}>
            <Text style={[styles.bannerTitle, { color: theme.text }]}>No live connection is configured</Text>
            <Text style={[styles.bannerBody, { color: theme.textSecondary }]}>
              Every partner below is documented from public requirements only. Credentials and
              admin TOTP MFA are required before any carrier action.
            </Text>
          </View>
        </View>

        {groups.available.length > 0 ? (
          <>
            <SectionHeader title="Portal available" />
            {renderGroup(groups.available)}
          </>
        ) : null}

        {groups.credentials.length > 0 ? (
          <>
            <SectionHeader title="Credentials required" />
            {renderGroup(groups.credentials)}
          </>
        ) : null}
      </Screen>
      <PartnerSheet onClose={() => setSelected(null)} partner={selected} />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { alignItems: "flex-start", borderRadius: RADIUS.md, borderWidth: 1, flexDirection: "row", gap: SPACE.sm, padding: 12 },
  bannerBody: { ...TYPO.caption },
  bannerTitle: { ...TYPO.captionStrong },
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  fill: { flex: 1 },
  grow: { flex: 1, gap: 2 },
});
