import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { SimulationBanner } from "@/components/operations";
import {
  AppModal,
  Badge,
  Button,
  Card,
  Header,
  KeyValueRow,
  ListRow,
  PartnerLogo,
  Screen,
  SectionHeader,
  SegmentedControl,
  StatusBadge,
} from "@/components/ui";
import { toOperationsFailure } from "@/domain/errors";
import { partnerForIntegration } from "@/domain/partners";
import type { AppRole } from "@/domain/types";
import { useOperations } from "@/store";
import { ICON, RADIUS, SPACE, TYPO, useTheme } from "@/theme";

const ROLE_OPTIONS = [
  { label: "Customer", value: "customer" },
  { label: "Driver", value: "driver" },
  { label: "Dispatcher", value: "dispatcher" },
] as const;

type Confirmation = "reset" | "signout" | null;

function AccountCard() {
  const theme = useTheme();
  const { currentAccount, effectiveRole } = useOperations();
  const initials = currentAccount?.displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() ?? "MF";
  const visibleRole = effectiveRole ?? currentAccount?.role ?? "customer";

  return (
    <Card>
      <View style={styles.accountRow}>
        <View style={[styles.avatar, { backgroundColor: theme.primary }]}><Text style={[styles.initials, { color: theme.primaryForeground }]}>{initials}</Text></View>
        <View style={styles.grow}>
          <Text style={[styles.accountName, { color: theme.text }]}>{currentAccount?.displayName ?? "Demo account"}</Text>
          <Text style={[styles.accountMeta, { color: theme.textSecondary }]}>{currentAccount?.title ?? "Role unavailable"}</Text>
          <Text style={[styles.accountMeta, { color: theme.textMuted }]}>{currentAccount?.companyName}</Text>
        </View>
        <Badge label={visibleRole} showDot tone="brand" />
      </View>
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <KeyValueRow label="Demo email" value={currentAccount?.email ?? "Unavailable"} />
      <KeyValueRow label="Signed-in account" value={currentAccount?.role ?? "Unavailable"} />
      <KeyValueRow isLast label="Appearance" value={`${theme.mode} · automatic`} />
    </Card>
  );
}

function IntegrationList() {
  const theme = useTheme();
  const { state } = useOperations();
  return (
    <Card padding="none">
      {state.integrations.map((integration, index) => {
        // Connections that belong to a partner in the directory lead with that
        // partner's logo; the rest (driver GPS, geofences) keep their icon,
        // because a monogram tile there would imply a company that isn't one.
        const partner = partnerForIntegration(integration.id, integration.name);
        return (
          <ListRow
            isLast={index === state.integrations.length - 1}
            key={integration.id}
            leading={
              partner ? (
                <PartnerLogo partner={partner} size="md" slug={partner.slug} />
              ) : (
                <Ionicons color={integration.isSimulation ? theme.warning : theme.textMuted} name={integration.isSimulation ? "flask-outline" : "unlink-outline"} size={ICON.md} />
              )
            }
            subtitle={integration.summary}
            title={integration.name}
            trailing={<StatusBadge size="sm" status={integration.status} />}
          />
        );
      })}
    </Card>
  );
}

function DispatcherRoleSwitcher() {
  const theme = useTheme();
  const { actions, currentAccount, effectiveRole } = useOperations();
  if (currentAccount?.role !== "dispatcher") return null;
  const visibleRole = effectiveRole ?? "dispatcher";

  function switchRole(role: AppRole): void {
    void actions.switchDemoRole(role);
  }

  return (
    <>
      <SectionHeader title="Preview another workspace" />
      <Card>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Dispatcher role switcher</Text>
        <Text style={[styles.cardCopy, { color: theme.textSecondary }]}>Your signed-in dispatcher account stays the same. Only the visible demo workspace changes.</Text>
        <SegmentedControl accessibilityLabel="Preview demo role" onChange={switchRole} options={ROLE_OPTIONS} value={visibleRole} />
      </Card>
    </>
  );
}

function DemoControls({ message, onReset, onSignOut }: {
  readonly message?: string;
  readonly onReset: () => void;
  readonly onSignOut: () => void;
}) {
  const theme = useTheme();
  return (
    <>
      <SectionHeader title="Demo controls" />
      {message ? (
        <Card variant="tinted">
          <View accessibilityRole="alert" style={styles.alertRow}>
            <Ionicons color={theme.danger} name="alert-circle-outline" size={ICON.md} />
            <Text style={[styles.alertText, { color: theme.danger }]}>{message}</Text>
          </View>
        </Card>
      ) : null}
      <View style={styles.actions}>
        <Button fullWidth onPress={onReset} title="Reset local demo" variant="secondary" />
        <Button fullWidth onPress={onSignOut} title="Sign out" variant="outline" />
      </View>
    </>
  );
}

function ConfirmationDialog({ confirmation, busy, onClose, onConfirm }: {
  readonly confirmation: Confirmation;
  readonly busy: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}) {
  const theme = useTheme();
  const reset = confirmation === "reset";
  const title = reset ? "Reset demo data?" : "Sign out?";
  const copy = reset
    ? "This restores the original local records and returns you to the demo sign-in screen."
    : "You can sign back in with any of the three demo accounts.";
  return (
    <AppModal footer={<View style={styles.modalActions}><Button disabled={busy} onPress={onClose} title="Cancel" variant="secondary" /><Button loading={busy} onPress={onConfirm} title={reset ? "Reset demo" : "Sign out"} variant={reset ? "danger" : "primary"} /></View>} onClose={onClose} title={title} visible={confirmation !== null}>
      <Text style={[styles.modalCopy, { color: theme.textSecondary }]}>{copy}</Text>
    </AppModal>
  );
}

export default function ProfileScreen() {
  const theme = useTheme();
  const { actions, error } = useOperations();
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function confirmAction(): Promise<void> {
    if (!confirmation) return;
    setBusy(true);
    setFailure(null);
    try {
      const succeeded = confirmation === "reset"
        ? await actions.resetDemo()
        : await actions.signOut();
      if (succeeded) setConfirmation(null);
      else setFailure("The demo action could not be completed.");
    } catch (error: unknown) {
      setFailure(toOperationsFailure(error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Header subtitle="Account, roles, and connection truth" title="Profile" />
      <Screen safeEdges={["left", "right", "bottom"]} scroll contentContainerStyle={styles.content}>
        <AccountCard />
        <SimulationBanner message="This is a locally persistent prototype. Target production access is not configured." />

        <DispatcherRoleSwitcher />

        <SectionHeader title="Integration status" />
        <IntegrationList />
        <DemoControls message={failure ?? error?.message} onReset={() => setConfirmation("reset")} onSignOut={() => setConfirmation("signout")} />
        <Text style={[styles.footnote, { color: theme.textMuted }]}>MF Superior Solutions · Freight operations prototype</Text>
      </Screen>
      <ConfirmationDialog busy={busy} confirmation={confirmation} onClose={() => setConfirmation(null)} onConfirm={() => { void confirmAction(); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  accountMeta: { ...TYPO.caption, marginTop: SPACE.xxs },
  accountName: { ...TYPO.heading },
  accountRow: { alignItems: "center", flexDirection: "row", gap: SPACE.md },
  actions: { gap: SPACE.sm },
  alertRow: { alignItems: "center", flexDirection: "row", gap: SPACE.sm },
  alertText: { ...TYPO.captionStrong, flex: 1 },
  avatar: { alignItems: "center", borderRadius: RADIUS.lg, height: 58, justifyContent: "center", width: 58 },
  cardCopy: { ...TYPO.body },
  cardTitle: { ...TYPO.cardTitle },
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  divider: { height: 1, marginVertical: SPACE.sm },
  fill: { flex: 1 },
  footnote: { ...TYPO.caption, paddingVertical: SPACE.md, textAlign: "center" },
  grow: { flex: 1, minWidth: 0 },
  initials: { ...TYPO.heading },
  modalActions: { flexDirection: "row", gap: SPACE.sm, justifyContent: "flex-end" },
  modalCopy: { ...TYPO.body },
});
