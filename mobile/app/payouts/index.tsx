import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { DriverAvatar } from "@/components/operations";
import {
  AnimatedButton,
  Card,
  EmptyState,
  Header,
  ListRow,
  Screen,
  SectionHeader,
  Sheet,
  StatusBadge,
} from "@/components/ui";
import { buildPayoutLineItems, summarizePayout } from "@/domain/payouts";
import {
  PAYOUT_STATUS_LABELS,
  formatPeriod,
  sortPayouts,
} from "@/route-support/driver-payments/utils";
import {
  formatSettlementPeriod,
  isPeriodSettled,
  nextSettlementPeriod,
} from "@/route-support/payouts/utils";
import { driverFullName } from "@/route-support/schedule/utils";
import { formatCents } from "@/route-support/trip-history/utils";
import { useOperations } from "@/store";
import { ICON, RADIUS, SPACE, TYPO, useTheme } from "@/theme";

export default function PayoutsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { actions, effectiveRole, payouts, shipments, state } = useOperations();
  const [issuing, setIssuing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [issueError, setIssueError] = useState<string | null>(null);

  const ordered = useMemo(() => sortPayouts(payouts), [payouts]);
  // The week to offer is derived from the data rather than assumed to be last
  // week, so the sheet is never a page of zeroes with no explanation.
  const period = useMemo(
    () => nextSettlementPeriod(shipments, payouts, state.drivers.map((driver) => driver.id)),
    [payouts, shipments, state.drivers],
  );

  const totals = useMemo(() => {
    let pendingCents = 0;
    let paidCents = 0;
    for (const payout of payouts) {
      if (payout.status === "paid") paidCents += payout.netCents;
      else if (payout.status !== "failed") pendingCents += payout.netCents;
    }
    return { paidCents, pendingCents };
  }, [payouts]);

  /**
   * What each driver would be owed for the offered week, computed with the same
   * builder the repository uses, so the preview cannot disagree with what
   * issuing actually produces.
   */
  const drafts = useMemo(() => state.drivers.map((driver) => {
    let sequence = 0;
    const lineItems = buildPayoutLineItems({
      driverId: driver.id,
      nextId: () => { sequence += 1; return `preview-${driver.id}-${sequence}`; },
      periodEnd: period.end,
      periodStart: period.start,
      shipments,
    });
    const alreadyIssued = isPeriodSettled(payouts, driver.id, period);
    return { alreadyIssued, driver, lineItems, totals: summarizePayout(lineItems) };
  }), [payouts, period, shipments, state.drivers]);

  const issue = useCallback(async (driverId: string) => {
    setBusy(driverId);
    setIssueError(null);
    const issued = await actions.issuePayout(driverId, period.start, period.end);
    setBusy(null);
    if (!issued) {
      setIssueError("That period could not be settled. It may overlap an existing settlement or have no delivered loads.");
    }
  }, [actions, period]);

  if (effectiveRole !== "admin") {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]}>
        <Header onBack={() => router.back()} showBack title="Payouts & payments" />
        <Screen safeEdges={["left", "right", "bottom"]}>
          <EmptyState
            icon={<Feather color={theme.textMuted} name="credit-card" size={36} />}
            message="Settlements are an admin console. Switch to an admin account to open it."
            title="Admin role required"
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
        rightAction={
          <AnimatedButton
            accessibilityLabel="Issue settlements for the last closed week"
            onPress={() => { setIssueError(null); setIssuing(true); }}
            size="sm"
            title="Issue"
          />
        }
        showBack
        subtitle={`${formatCents(totals.pendingCents)} outstanding`}
        title="Payouts & payments"
      />
      <Screen contentContainerStyle={styles.content} safeEdges={["left", "right", "bottom"]} scroll>
        <Card>
          <View style={styles.totalsRow}>
            <Total label="Outstanding" tone="warning" value={formatCents(totals.pendingCents)} />
            <Total label="Paid to date" tone="success" value={formatCents(totals.paidCents)} />
          </View>
          <View style={[styles.privacy, { borderTopColor: theme.border }]}>
            <Feather color={theme.info} name="lock" size={ICON.sm} />
            <Text style={[styles.privacyText, { color: theme.textMuted }]}>
              Recording a settlement as paid is a ledger entry. It moves no money, and a driver&apos;s
              payout handle is never shown here — only the rail it went out on.
            </Text>
          </View>
        </Card>

        {issueError ? (
          <View
            accessibilityRole="alert"
            style={[
              styles.error,
              { backgroundColor: theme.dangerMuted, borderColor: theme.tint.danger.medium },
            ]}
          >
            <Feather color={theme.danger} name="alert-circle" size={ICON.sm} />
            <Text style={[styles.errorText, { color: theme.text }]}>{issueError}</Text>
          </View>
        ) : null}

        <SectionHeader title="Settlements" />
        {ordered.length === 0 ? (
          <EmptyState
            icon={<Feather color={theme.textMuted} name="file-text" size={36} />}
            message="Issue a settlement to start the ledger."
            title="No settlements yet"
          />
        ) : (
          <Card padding="none">
            {ordered.map((payout, index) => {
              const driver = state.drivers.find((candidate) => candidate.id === payout.driverId);
              return (
                <ListRow
                  isLast={index === ordered.length - 1}
                  key={payout.id}
                  leading={driver
                    ? <DriverAvatar driver={driver} ring={false} size={36} />
                    : <Feather color={theme.textMuted} name="user" size={ICON.md} />}
                  onPress={() => router.push({
                    params: { id: payout.id },
                    pathname: "/payouts/[id]",
                  })}
                  rich
                  subtitle={`${formatPeriod(payout)} · ${payout.lineItems.length} line items`}
                  title={driver ? driverFullName(driver) : "Unknown driver"}
                  trailing={
                    <View style={styles.trailing}>
                      <Text style={[styles.net, { color: theme.text }]}>
                        {formatCents(payout.netCents)}
                      </Text>
                      <StatusBadge size="sm" status={PAYOUT_STATUS_LABELS[payout.status]} />
                    </View>
                  }
                />
              );
            })}
          </Card>
        )}
      </Screen>

      {issuing ? (
        <Sheet
          onClose={() => setIssuing(false)}
          title={`Settle ${formatSettlementPeriod(period)}`}
          visible
        >
          <View style={styles.sheetBody}>
            {drafts.map((draft, index) => (
              <ListRow
                disabled={busy !== null || draft.alreadyIssued || draft.lineItems.length === 0}
                isLast={index === drafts.length - 1}
                key={draft.driver.id}
                leading={<DriverAvatar driver={draft.driver} ring={false} size={36} />}
                onPress={() => void issue(draft.driver.id)}
                rich
                subtitle={draft.alreadyIssued
                  ? "Already settled for this period"
                  : draft.lineItems.length === 0
                    ? "No delivered loads in this period"
                    : `${draft.lineItems.length} line items`}
                title={driverFullName(draft.driver)}
                trailing={
                  <Text
                    style={[
                      styles.net,
                      {
                        color: draft.lineItems.length === 0 || draft.alreadyIssued
                          ? theme.textMuted
                          : theme.text,
                      },
                    ]}
                  >
                    {formatCents(draft.totals.netCents)}
                  </Text>
                }
              />
            ))}
          </View>
        </Sheet>
      ) : null}
    </View>
  );
}

function Total({
  label,
  tone,
  value,
}: {
  readonly label: string;
  readonly tone: "warning" | "success";
  readonly value: string;
}) {
  const theme = useTheme();
  return (
    <View accessibilityLabel={`${label} ${value}`} style={styles.total}>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        numberOfLines={1}
        style={[styles.totalValue, { color: theme[tone] }]}
      >
        {value}
      </Text>
      <Text style={[styles.totalLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  error: {
    alignItems: "flex-start",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACE.sm,
    padding: SPACE.md,
  },
  errorText: { ...TYPO.caption, flex: 1 },
  fill: { flex: 1 },
  net: { ...TYPO.rowTitle },
  privacy: { alignItems: "flex-start", borderTopWidth: 1, flexDirection: "row", gap: SPACE.xs, paddingTop: SPACE.sm },
  privacyText: { ...TYPO.subtitle, flex: 1, lineHeight: 16 },
  sheetBody: { paddingBottom: SPACE.md },
  total: { flex: 1, gap: 2 },
  totalLabel: { ...TYPO.metricLabel },
  totalValue: { ...TYPO.metric, fontSize: 24, lineHeight: 28 },
  totalsRow: { flexDirection: "row", gap: SPACE.md },
  trailing: { alignItems: "flex-end", gap: SPACE.xxs },
});
