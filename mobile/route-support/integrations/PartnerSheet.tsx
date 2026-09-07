import Feather from "@expo/vector-icons/Feather";
import * as Linking from "expo-linking";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { AnimatedButton, Sheet, StatusBadge } from "@/components/ui";
import { validatedPartnerPortal, type FreightPartnerDefinition } from "@/features/partner-integrations";
import { RADIUS, SPACE, TYPO, useTheme } from "@/theme";

interface Props {
  readonly partner: FreightPartnerDefinition | null;
  readonly onClose: () => void;
}

/** Detail sheet for one carrier connection. Portal URLs are resolved through
 *  validatedPartnerPortal so an arbitrary URL can never be opened. */
export function PartnerSheet({ partner, onClose }: Props) {
  const theme = useTheme();
  if (!partner) return null;
  const openPortal = async () => { await Linking.openURL(validatedPartnerPortal(partner)); };
  return (
    <Sheet
      footer={<AnimatedButton accessibilityLabel={`Open ${partner.name} portal`} fullWidth onPress={() => void openPortal()} title="Open Portal" />}
      onClose={onClose}
      title={partner.name}
      visible
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.status}>
          <StatusBadge status={partner.status === "portal_available" ? "onboarding" : "not configured"} />
          <Text style={[styles.statusLabel, { color: theme.text }]}>{partner.statusLabel}</Text>
        </View>
        <Text style={[styles.summary, { color: theme.textSecondary }]}>{partner.summary}</Text>
        <View style={[styles.mfaNotice, { backgroundColor: theme.warningMuted, borderColor: theme.tint.warning.medium }]}>
          <Feather color={theme.warning} name="lock" size={17} />
          <Text style={[styles.mfaText, { color: theme.text }]}>Admin TOTP MFA is required before setup, credentials, or sensitive carrier actions.</Text>
        </View>
        <Text style={[styles.heading, { color: theme.text }]}>Verified capability contract</Text>
        {partner.capabilities.map((capability) => (
          <View key={capability} style={styles.bullet}>
            <Feather color={theme.success} name="check" size={15} />
            <Text style={[styles.bulletText, { color: theme.textSecondary }]}>{capability}</Text>
          </View>
        ))}
        <Text style={[styles.heading, { color: theme.text }]}>Onboarding steps</Text>
        {partner.onboarding.map((step, index) => (
          <View key={step} style={styles.bullet}>
            <View style={[styles.stepNumber, { backgroundColor: theme.primaryMuted }]}>
              <Text style={[styles.stepNumberText, { color: theme.primaryLight }]}>{index + 1}</Text>
            </View>
            <Text style={[styles.bulletText, { color: theme.textSecondary }]}>{step}</Text>
          </View>
        ))}
        <Text style={[styles.lastSync, { color: theme.textMuted }]}>Last sync: Never · No credentials configured · No live connection claimed</Text>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  bullet: { alignItems: "flex-start", flexDirection: "row", gap: SPACE.sm },
  bulletText: { ...TYPO.caption, flex: 1 },
  content: { gap: SPACE.md, paddingBottom: SPACE.md },
  heading: { ...TYPO.cardTitle, marginTop: SPACE.sm },
  lastSync: { ...TYPO.subtitle, lineHeight: 17, marginTop: SPACE.sm },
  mfaNotice: { alignItems: "flex-start", borderRadius: RADIUS.md, borderWidth: 1, flexDirection: "row", gap: SPACE.sm, padding: 12 },
  mfaText: { ...TYPO.caption, flex: 1 },
  status: { alignItems: "flex-start", gap: SPACE.sm },
  statusLabel: { ...TYPO.captionStrong },
  stepNumber: { alignItems: "center", borderRadius: 12, height: 24, justifyContent: "center", width: 24 },
  stepNumberText: { ...TYPO.subtitle },
  summary: { ...TYPO.body },
});
