import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button, Card, Screen, TextField } from "@/components/ui";
import { useOperations } from "@/store";
import { RADIUS, SPACE, TYPO, useTheme } from "@/theme";

const AUTH_ERROR = "That email and PIN do not match a demo account.";

export default function LoginScreen() {
  const theme = useTheme();
  const { accounts, actions } = useOperations();
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    setError(null);
    setIsSubmitting(true);
    const succeeded = await actions.signIn(email, pin);
    if (!succeeded) setError(AUTH_ERROR);
    setIsSubmitting(false);
  };

  return (
    <Screen scroll contentContainerStyle={styles.content}>
      <View style={styles.brand}>
        <View style={[styles.mark, { backgroundColor: theme.primary }]}>
          <Text style={[styles.markText, { color: theme.primaryForeground }]}>MF</Text>
        </View>
        <Text style={[styles.title, { color: theme.text }]}>MF Superior</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Freight operations, from tender to delivery.</Text>
      </View>

      <Card title="Open the operations demo">
        <View style={styles.form}>
          <TextField
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            label="Demo email"
            onChangeText={setEmail}
            placeholder="name@company.demo"
            value={email}
          />
          <TextField
            error={error ?? undefined}
            keyboardType="number-pad"
            label="4-digit PIN"
            maxLength={4}
            onChangeText={setPin}
            onSubmitEditing={() => void submit()}
            secureTextEntry
            value={pin}
          />
          <Button
            disabled={!email.trim() || pin.length !== 4}
            fullWidth
            loading={isSubmitting}
            onPress={() => void submit()}
            title="Sign in"
          />
        </View>
      </Card>

      <View style={styles.accounts}>
        <Text style={[styles.eyebrow, { color: theme.textMuted }]}>DEMO ACCOUNTS</Text>
        {accounts.map((account) => (
          <Card
            key={account.id}
            onPress={() => {
              setEmail(account.email);
              setPin(account.demoPin);
              setError(null);
            }}
            padding="compact"
          >
            <View style={styles.accountRow}>
              <View style={[styles.roleMark, { backgroundColor: theme.primaryMuted }]}>
                <Text style={[styles.roleMarkText, { color: theme.primaryLight }]}>{account.role.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={styles.accountCopy}>
                <Text style={[styles.accountName, { color: theme.text }]}>{account.displayName}</Text>
                <Text style={[styles.accountMeta, { color: theme.textSecondary }]}>{account.role} · PIN {account.demoPin}</Text>
              </View>
              <Text style={[styles.useText, { color: theme.primaryLight }]}>Use</Text>
            </View>
          </Card>
        ))}
      </View>

      <Text style={[styles.disclaimer, { color: theme.textMuted }]}>Prototype data stays on this device. Target workflows are simulated and are not connected to Target systems.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  accountCopy: { flex: 1, gap: 2 },
  accountMeta: { ...TYPO.caption, textTransform: "capitalize" },
  accountName: { ...TYPO.bodyStrong },
  accountRow: { alignItems: "center", flexDirection: "row", gap: SPACE.md },
  accounts: { gap: SPACE.sm },
  brand: { alignItems: "center", gap: SPACE.sm, paddingBottom: SPACE.md, paddingTop: SPACE.xl },
  content: { gap: SPACE.lg, justifyContent: "center", minHeight: "100%" },
  disclaimer: { ...TYPO.caption, lineHeight: 18, paddingBottom: SPACE.xl, textAlign: "center" },
  eyebrow: { ...TYPO.eyebrow },
  form: { gap: SPACE.md },
  mark: { alignItems: "center", borderRadius: RADIUS.md, height: 58, justifyContent: "center", width: 58 },
  markText: { ...TYPO.heading },
  roleMark: { alignItems: "center", borderRadius: RADIUS.sm, height: 40, justifyContent: "center", width: 40 },
  roleMarkText: { ...TYPO.bodyStrong },
  subtitle: { ...TYPO.body, textAlign: "center" },
  title: { ...TYPO.largeTitle, fontSize: 32, lineHeight: 38 },
  useText: { ...TYPO.label },
});
