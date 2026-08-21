import Feather from "@expo/vector-icons/Feather";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AnimatedButton, Screen } from "@/components/ui";
import { getProductionAuthService } from "@/features/auth/runtime-service";
import { toAuthFailure } from "@/lib/auth";
import { useOperations } from "@/store";
import { RADIUS, SPACE, TYPO, useTheme } from "@/theme";

export default function AuthCallbackScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { actions } = useOperations();
  const liveUrl = Linking.useURL();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const complete = async () => {
      const url = liveUrl ?? await Linking.getInitialURL();
      const service = getProductionAuthService();
      if (!url || !service) throw new Error("Authentication callback is not configured.");
      const result = await service.handleCallback(url);
      if (!active) return;
      if (result.kind === "password-recovery") { router.replace("/(auth)/reset-password"); return; }
      await actions.restoreSession();
      router.replace(result.identity.role === "admin" && result.identity.mfa.status !== "verified" ? "/mfa" : "/(tabs)");
    };
    void complete().catch((caught: unknown) => { if (active) setError(toAuthFailure(caught).message); });
    return () => { active = false; };
  }, [actions, liveUrl, router]);

  return <Screen contentContainerStyle={styles.content}>{error ? <><View style={[styles.icon, { backgroundColor: theme.dangerMuted }]}><Feather color={theme.danger} name="x" size={28} /></View><Text style={[styles.title, { color: theme.text }]}>Link unavailable</Text><Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={[styles.body, { color: theme.textSecondary }]}>{error}</Text><AnimatedButton onPress={() => router.replace("/(auth)/login")} title="Return to sign in" /></> : <><ActivityIndicator color={theme.primaryLight} size="large" /><Text style={[styles.title, { color: theme.text }]}>Securing your session</Text><Text style={[styles.body, { color: theme.textSecondary }]}>Verifying the link and restoring your MF Superior Products account.</Text></>}</Screen>;
}

const styles = StyleSheet.create({
  body: { ...TYPO.body, maxWidth: 340, textAlign: "center" },
  content: { alignItems: "center", flex: 1, gap: SPACE.md, justifyContent: "center" },
  icon: { alignItems: "center", borderRadius: RADIUS.lg, height: 64, justifyContent: "center", width: 64 },
  title: { ...TYPO.heading, textAlign: "center" },
});
