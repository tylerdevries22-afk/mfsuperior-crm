import Feather from "@expo/vector-icons/Feather";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { DriverAvatar } from "@/components/operations";
import {
  AnimatedButton,
  Card,
  EmptyState,
  Header,
  KeyValueRow,
  Screen,
  SectionHeader,
  Sheet,
  statusLabel,
  StatusBadge,
} from "@/components/ui";
import { PAYOUT_RAILS, type PayoutRail } from "@/domain/types";
import {
  PAYOUT_STATUS_LABELS,
  formatPeriod,
  presentationFor,
} from "@/route-support/driver-payments/utils";
import { driverFullName } from "@/route-support/schedule/utils";
import { formatCents } from "@/route-support/trip-history/utils";
import { useOperations } from "@/store";
import { ICON, RADIUS, SPACE, TYPO, useTheme } from "@/theme";

export default function PayoutDetailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { actions, effectiveRole, payouts, state } = useOperations();
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);

  const payout = useMemo(
    () => payouts.find((candidate) => candidate.id === id) ?? null,
    [id, payouts],
  );
  const driver = useMemo(
    () => payout ? state.drivers.find((candidate) => candidate.id === payout.driverId) ?? null : null,
    [payout, state.drivers],
  );

  const markPaid = useCallback(async (rail: PayoutRail) => {
    if (!payout) {
      return;
    }
    setBusy(true);
    const recorded = await actions.markPayoutPaid(payout.id, rail);
    setBusy(false);
    if (recorded) {
      setRecording(false);
    }
  }, [actions, payout]);

  if (effectiveRole !== "admin" || !payout) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]}>
        <Header onBack={() => router.back()} showBack title="Settlement" />
        <Screen safeEdges={["left", "right", "bottom"]}>
          <EmptyState
            icon={<Feather color={theme.textMuted} name="credit-card" size={36} />}
            message={effectiveRole === "admin"
              ? "That settlement no longer exists."
              : "Settlements are an admin console. Switch to an admin account to open it."}
            title={effectiveRole === "admin" ? "Not found" : "Admin role required"}
          />
        </Screen>
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Header
        centered
        onBack={() => router.back()}
        showBack
        subtitle={formatPeriod(payout)}
        title={driver ? driverFullName(driver) : "Settlement"}
      />
      <Screen contentContainerStyle={styles.content} safeEdges={["left", "right", "bottom"]} scroll>
        <Card>
          <View style={styles.headRow}>
            {driver ? <DriverAvatar driver={driver} size={44} /> : null}
            <View style={styles.grow}>
              <Text style={[styles.net, { color: theme.text }]}>{formatCents(payout.netCents)}</Text>
              <Text style={[styles.netLabel, { color: theme.textMuted }]}>Net settlement</Text>
            </View>
            <StatusBadge status={PAYOUT_STATUS_LABELS[payout.status]} />
          </View>
        </Card>

        <SectionHeader title="Line items" />
        <Card padding="none">
          {payout.lineItems.map((lineItem, index) => (
            <View
              key={lineItem.id}
              style={[
                styles.lineItem,
                index < payout.lineItems.length - 1 && {
                  borderBottomColor: theme.border,
                  borderBottomWidth: 1,
                },
              ]}
            >
              <View style={styles.grow}>
                <Text style={[styles.lineItemText, { color: theme.text }]}>
                  {lineItem.description}
                </Text>
                <Text style={[styles.lineItemKind, { color: theme.textMuted }]}>
                  {statusLabel(lineItem.kind)}
                </Text>
              </View>
              <Text
                style={[
                  styles.lineItemAmount,
                  { color: lineItem.amountCents < 0 ? theme.danger : theme.text },
                ]}
              >
                {lineItem.amountCents < 0 ? "−" : ""}{formatCents(Math.abs(lineItem.amountCents))}
              </Text>
            </View>
          ))}
        </Card>

        <Card padding="none">
          <KeyValueRow label="Gross" value={formatCents(payout.grossCents)} />
          <KeyValueRow label="Deductions" value={`−${formatCents(payout.deductionCents)}`} />
          <KeyValueRow label="Net" value={formatCents(payout.netCents)} />
          {payout.issuedAt ? (
            <KeyValueRow label="Issued" value={new Date(payout.issuedAt).toLocaleString()} />
          ) : null}
          {payout.rail ? (
            <KeyValueRow label="Sent on" value={presentationFor(payout.rail).label} />
          ) : null}
          <KeyValueRow
            isLast
            label="Paid"
            value={payout.paidAt ? new Date(payout.paidAt).toLocaleString() : "Not yet"}
          />
        </Card>

        {payout.status === "paid" ? (
          <View
            style={[
              styles.paidNote,
              { backgroundColor: theme.successMuted, borderColor: theme.tint.success.medium },
            ]}
          >
            <Feather color={theme.success} name="check-circle" size={ICON.sm} />
            <Text style={[styles.paidText, { color: theme.text }]}>
              Recorded as paid{payout.rail ? ` on ${presentationFor(payout.rail).label}` : ""}.
            </Text>
          </View>
        ) : (
          <AnimatedButton
            accessibilityLabel="Record this settlement as paid"
            fullWidth
            onPress={() => setRecording(true)}
            title="Record as paid"
          />
        )}
      </Screen>

      {recording ? (
        <Sheet onClose={() => setRecording(false)} title="Which rail was it sent on?" visible>
          <View style={styles.sheetBody}>
            <Text style={[styles.sheetNote, { color: theme.textSecondary }]}>
              This records that a transfer already happened. MF Superior moves no money, and the
              driver&apos;s handle is never shown here.
            </Text>
            {PAYOUT_RAILS.map((rail) => {
              const presentation = presentationFor(rail);
              return (
                <AnimatedButton
                  accessibilityLabel={`Record as paid on ${presentation.label}`}
                  disabled={busy}
                  fullWidth
                  key={rail}
                  onPress={() => void markPaid(rail)}
                  title={presentation.label}
                  variant="outline"
                />
              );
            })}
          </View>
        </Sheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  fill: { flex: 1 },
  grow: { flex: 1, minWidth: 0 },
  headRow: { alignItems: "center", flexDirection: "row", gap: SPACE.md },
  lineItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACE.sm,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
  },
  lineItemAmount: { ...TYPO.rowTitle },
  lineItemKind: { ...TYPO.subtitle, marginTop: 2 },
  lineItemText: { ...TYPO.body },
  net: { ...TYPO.metric },
  netLabel: { ...TYPO.metricLabel },
  paidNote: {
    alignItems: "center",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACE.sm,
    padding: SPACE.md,
  },
  paidText: { ...TYPO.caption, flex: 1 },
  sheetBody: { gap: SPACE.xs, paddingBottom: SPACE.md },
  sheetNote: { ...TYPO.caption, marginBottom: SPACE.xs },
});
