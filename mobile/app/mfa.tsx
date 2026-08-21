import Feather from "@expo/vector-icons/Feather";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedButton } from "@/components/ui";
import { getProductionAuthService } from "@/features/auth/runtime-service";
import { toAuthFailure, type MfaChallenge, type TotpEnrollment } from "@/lib/auth";
import { useOperations } from "@/store";
import { FONTS, RADIUS, SPACE, TYPO, useTheme } from "@/theme";

interface ChallengeState {
  readonly challenge: MfaChallenge;
  readonly factorId: string;
}

export default function MfaScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { actions } = useOperations();
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [challenge, setChallenge] = useState<ChallengeState | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void prepareMfa().then((state) => {
      if (!active) return;
      if (state === "verified") router.replace("/(tabs)");
      else if (state) setChallenge(state);
      setLoading(false);
    }).catch((caught: unknown) => {
      if (active) { setError(toAuthFailure(caught).message); setLoading(false); }
    });
    return () => { active = false; };
  }, [router]);

  const enroll = async () => {
    const service = getProductionAuthService();
    if (!service) { setError("MFA requires configured production authentication."); return; }
    setLoading(true); setError(null);
    try {
      const nextEnrollment = await service.enrollTotp("MF Superior Products");
      const nextChallenge = await service.challengeMfa(nextEnrollment.factorId);
      setEnrollment(nextEnrollment);
      setChallenge({ challenge: nextChallenge, factorId: nextEnrollment.factorId });
    } catch (caught: unknown) { setError(toAuthFailure(caught).message); }
    finally { setLoading(false); }
  };

  const verify = async () => {
    const service = getProductionAuthService();
    if (!service || !challenge) { setError("Start MFA setup before entering a code."); return; }
    setLoading(true); setError(null);
    try {
      await service.verifyMfa(challenge.factorId, challenge.challenge.challengeId, code);
      await actions.restoreSession();
      router.replace("/(tabs)");
    } catch (caught: unknown) { setError(toAuthFailure(caught).message); }
    finally { setLoading(false); }
  };

  return <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}><View style={styles.content}><View style={[styles.icon, { backgroundColor: theme.primaryMuted, borderColor: theme.tint.primary.medium }]}><Feather color={theme.primaryLight} name="shield" size={32} /></View><Text style={[styles.eyebrow, { color: theme.primaryLight }]}>ADMIN SECURITY</Text><Text style={[styles.title, { color: theme.text }]}>Verify it’s you</Text><Text style={[styles.description, { color: theme.textSecondary }]}>A time-based one-time password is required before integration management, Google Workspace, user administration, or sensitive carrier actions.</Text>{loading && !challenge ? <ActivityIndicator color={theme.primaryLight} size="large" /> : null}{enrollment ? <View style={[styles.enrollment, { backgroundColor: theme.surface, borderColor: theme.border }]}><Image accessibilityLabel="TOTP setup QR code" contentFit="contain" source={{ uri: enrollment.qrCode }} style={styles.qr} /><Text style={[styles.secretLabel, { color: theme.textMuted }]}>MANUAL SETUP KEY</Text><Text selectable style={[styles.secret, { color: theme.text }]}>{enrollment.secret}</Text></View> : null}{!challenge && !loading ? <AnimatedButton fullWidth onPress={() => void enroll()} size="lg" title="Set up authenticator" /> : null}{challenge ? <View style={styles.verify}><Text style={[styles.codeLabel, { color: theme.textSecondary }]}>Six-digit verification code</Text><TextInput accessibilityLabel="Six-digit verification code" keyboardType="number-pad" maxLength={6} onChangeText={(value) => setCode(value.replace(/\D/g, ""))} placeholder="000000" placeholderTextColor={theme.textMuted} style={[styles.code, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, color: theme.text }]} value={code} /><AnimatedButton disabled={code.length !== 6} fullWidth loading={loading} onPress={() => void verify()} size="lg" title="Verify and continue" /></View> : null}{error ? <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={[styles.error, { backgroundColor: theme.dangerMuted }]}><Feather color={theme.danger} name="alert-circle" size={16} /><Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text></View> : null}<Pressable accessibilityRole="button" onPress={() => void actions.signOut()} style={styles.signOut}><Text style={[styles.signOutText, { color: theme.textMuted }]}>Sign out</Text></Pressable></View></SafeAreaView>;
}

async function prepareMfa(): Promise<ChallengeState | "verified" | null> {
  const service = getProductionAuthService();
  if (!service) return null;
  const state = await service.getMfaState();
  if (state.status === "verified") return "verified";
  const factor = state.factors.find((candidate) => candidate.status === "verified");
  if (!factor) return null;
  return { challenge: await service.challengeMfa(factor.id), factorId: factor.id };
}

const styles = StyleSheet.create({
  code: { fontFamily: FONTS.bold, fontSize: 28, letterSpacing: 12, minHeight: 62, textAlign: "center", borderRadius: RADIUS.md, borderWidth: 1 },
  codeLabel: { ...TYPO.captionStrong, textAlign: "center" },
  content: { alignItems: "center", flex: 1, gap: SPACE.md, justifyContent: "center", padding: SPACE.lg },
  description: { ...TYPO.body, lineHeight: 23, maxWidth: 360, textAlign: "center" },
  enrollment: { alignItems: "center", borderRadius: RADIUS.lg, borderWidth: 1, gap: SPACE.sm, padding: SPACE.md, width: "100%" },
  error: { alignItems: "flex-start", borderRadius: RADIUS.md, flexDirection: "row", gap: SPACE.sm, padding: 13, width: "100%" },
  errorText: { ...TYPO.captionStrong, flex: 1 },
  eyebrow: { ...TYPO.eyebrow },
  icon: { alignItems: "center", borderRadius: 38, borderWidth: 1, height: 76, justifyContent: "center", width: 76 },
  qr: { backgroundColor: "#FFFFFF", borderRadius: 12, height: 168, width: 168 },
  safe: { flex: 1 },
  secret: { fontFamily: FONTS.mono, fontSize: 12, letterSpacing: 0.5, textAlign: "center" },
  secretLabel: { ...TYPO.metricLabel },
  signOut: { alignItems: "center", justifyContent: "center", minHeight: 44 },
  signOutText: { ...TYPO.captionStrong },
  title: { ...TYPO.largeTitle, textAlign: "center" },
  verify: { gap: SPACE.md, width: "100%" },
});
