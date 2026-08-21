import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { AnimatedButton, Screen } from "@/components/ui";
import { getProductionAuthService } from "@/features/auth/runtime-service";
import { toAuthFailure } from "@/lib/auth";
import { useOperations } from "@/store";
import { RADIUS, SPACE, TYPO, useTheme } from "@/theme";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { actions } = useOperations();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (password !== confirmation) { setError("Passwords do not match."); return; }
    const service = getProductionAuthService();
    if (!service) { setError("Password recovery is not configured."); return; }
    setBusy(true); setError(null);
    try { await service.completePasswordRecovery(password); await actions.restoreSession(); router.replace("/(tabs)"); }
    catch (caught: unknown) { setError(toAuthFailure(caught).message); }
    finally { setBusy(false); }
  };

  return <Screen keyboardAware scroll contentContainerStyle={styles.content}><View style={[styles.icon, { backgroundColor: theme.primaryMuted, borderColor: theme.tint.primary.medium }]}><Feather color={theme.primaryLight} name="key" size={28} /></View><Text style={[styles.title, { color: theme.text }]}>Create a new password</Text><Text style={[styles.body, { color: theme.textSecondary }]}>Use 12–128 characters. Your other sessions will be reviewed after the update.</Text><PasswordField label="New password" onChange={setPassword} value={password} /><PasswordField label="Confirm password" onChange={setConfirmation} value={confirmation} />{error ? <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}<AnimatedButton disabled={password.length < 12 || confirmation.length < 12} fullWidth loading={busy} onPress={() => void submit()} size="lg" title="Update password" /></Screen>;
}

function PasswordField({ label, onChange, value }: { readonly label: string; readonly onChange: (value: string) => void; readonly value: string }) {
  const theme = useTheme();
  return <View style={styles.field}><Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text><TextInput accessibilityLabel={label} onChangeText={onChange} placeholder="12 characters minimum" placeholderTextColor={theme.textMuted} secureTextEntry style={[styles.input, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, color: theme.text }]} value={value} /></View>;
}

const styles = StyleSheet.create({
  body: { ...TYPO.body, textAlign: "center" },
  content: { alignItems: "center", flex: 1, gap: SPACE.md, justifyContent: "center" },
  error: { ...TYPO.captionStrong, alignSelf: "stretch" },
  field: { alignSelf: "stretch", gap: 6 },
  icon: { alignItems: "center", borderRadius: 34, borderWidth: 1, height: 68, justifyContent: "center", width: 68 },
  input: { ...TYPO.body, borderRadius: RADIUS.md, borderWidth: 1, minHeight: 54, paddingHorizontal: 14 },
  label: { ...TYPO.captionStrong, marginLeft: 3 },
  title: { ...TYPO.largeTitle, fontSize: 32, lineHeight: 37, textAlign: "center" },
});
