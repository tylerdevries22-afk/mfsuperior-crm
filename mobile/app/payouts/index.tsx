import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";

import { PayoutRailMosaic } from "@/components/operations";
import {
  AnimatedButton,
  EmptyState,
  Header,
  Screen,
  SectionHeader,
} from "@/components/ui";
import { IssueSettlementsSheet } from "@/route-support/payouts/_components/IssueSettlementsSheet";
import {
  IssueErrorNotice,
  PayoutTotalsCard,
} from "@/route-support/payouts/_components/PayoutTotalsCard";
import { SettlementList } from "@/route-support/payouts/_components/SettlementList";
import { styles } from "@/route-support/payouts/styles";
import { useIssueDrafts } from "@/route-support/payouts/useIssueDrafts";
import {
  earliestOpenPeriod,
  formatSettlementPeriod,
  type SettlementPeriod,
} from "@/route-support/payouts/utils";
import { sortPayouts } from "@/route-support/driver-payments/utils";
import { formatCents } from "@/route-support/trip-history/utils";
import { useOperations } from "@/store";
import { useTheme } from "@/theme";

export default function PayoutsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { actions, effectiveRole, payouts, shipments, state } = useOperations();
  const [issuing, setIssuing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [issueError, setIssueError] = useState<string | null>(null);

  const ordered = useMemo(() => sortPayouts(payouts), [payouts]);
  const headerPeriod = useMemo(
    () => earliestOpenPeriod(shipments, payouts, state.drivers.map((driver) => driver.id)),
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

  const drafts = useIssueDrafts(state.drivers, payouts, shipments);

  const issue = useCallback(async (driverId: string, period: SettlementPeriod) => {
    setBusy(driverId);
    setIssueError(null);
    const issued = await actions.issuePayout(driverId, period.start, period.end);
    setBusy(null);
    if (!issued) {
      setIssueError("That period could not be settled. It may overlap an existing settlement or have no delivered loads.");
    }
  }, [actions]);

  if (effectiveRole !== "admin") {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]}>
        <Header onBack={() => router.back()} showBack title="Payouts & payments" />
        <Screen safeEdges={["left", "right", "bottom"]}>
          <EmptyState
            icon={<PayoutRailMosaic size="md" />}
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
        subtitle={headerPeriod
          ? `${formatCents(totals.pendingCents)} outstanding · next ${formatSettlementPeriod(headerPeriod)}`
          : `${formatCents(totals.pendingCents)} outstanding · all settled`}
        title="Payouts & payments"
      />
      <Screen contentContainerStyle={styles.content} safeEdges={["left", "right", "bottom"]} scroll>
        <PayoutTotalsCard paidCents={totals.paidCents} pendingCents={totals.pendingCents} />
        {issueError ? <IssueErrorNotice message={issueError} /> : null}

        <SectionHeader title="Settlements" />
        <SettlementList
          drivers={state.drivers}
          onOpen={(id) => router.push({ params: { id }, pathname: "/payouts/[id]" })}
          payouts={ordered}
        />
      </Screen>

      {issuing ? (
        <IssueSettlementsSheet
          busyDriverId={busy}
          drafts={drafts}
          onClose={() => setIssuing(false)}
          onIssue={(driverId, period) => void issue(driverId, period)}
        />
      ) : null}
    </View>
  );
}
