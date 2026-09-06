import {
  Card,
  EmptyState,
  Header,
  ListRow,
  Screen,
  SectionHeader,
  StatusBadge
} from "@/components/ui";
import { PayoutMethodSheet } from "@/route-support/driver-payments/_components/PayoutMethodSheet";
import {
  PAYOUT_STATUS_LABELS,
  RAIL_PRESENTATION,
  formatPeriod,
  methodForRail
} from "@/route-support/driver-payments/utils";
import { formatCents } from "@/route-support/trip-history/utils";
import { ICON } from "@/theme";
import Feather from "@expo/vector-icons/Feather";
import { Platform, Text, View } from "react-native";
import { Earning, RailRow } from "../route-support/driver-payments/_components/PaymentRows";
import { styles } from "../route-support/driver-payments/_components/paymentStyles";
import { PayoutDetailSheet } from "../route-support/driver-payments/_components/PayoutDetailSheet";
import { useDriverPaymentsScreen } from "../route-support/driver-payments/_components/useDriverPaymentsScreen";

export default function DriverPaymentsScreen() {
  const { router, theme, methods, editingRail, setEditingRail, openPayout, setOpenPayout, busy, saveError, setSaveError, toast, isDriver, summary, ordered, onSave, onRemove, onSetDefault, onCopy, onOpenApp } = useDriverPaymentsScreen();
  if (!isDriver) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]}>
        <Header onBack={() => router.back()} showBack title="Payments" />
        <Screen safeEdges={["left", "right", "bottom"]}>
          <EmptyState
            icon={<Feather color={theme.textMuted} name="credit-card" size={36} />}
            message="Payout handles belong to a driver and are only readable by them. Switch to a driver account to manage yours."
            title="Driver role required"
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
        subtitle="Where your settlements go"
        title="Payments"
      />
      <Screen contentContainerStyle={styles.content} safeEdges={["left", "right", "bottom"]} scroll>
        <Card>
          <View style={styles.earningsRow}>
            <Earning label="Pending" tone="warning" value={formatCents(summary.pendingCents)} />
            <Earning label="Paid to date" tone="success" value={formatCents(summary.paidCents)} />
          </View>
          {summary.nextPayout ? (
            <Text style={[styles.nextNote, { color: theme.textSecondary }]}>
              Next settlement covers {formatPeriod(summary.nextPayout)}.
            </Text>
          ) : null}
        </Card>

        <SectionHeader title="Payout methods" />
        <Card padding="none">
          {RAIL_PRESENTATION.map((presentation, index) => {
            const method = methodForRail(methods, presentation.rail);
            return (
              <RailRow
                isLast={index === RAIL_PRESENTATION.length - 1}
                key={presentation.rail}
                method={method}
                onCopy={() => method && void onCopy(method)}
                onEdit={() => { setSaveError(null); setEditingRail(presentation.rail); }}
                onOpenApp={() => method && void onOpenApp(method)}
                onSetDefault={() => method && void onSetDefault(method.id)}
                presentation={presentation}
              />
            );
          })}
        </Card>

        <View
          style={[
            styles.privacy,
            { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
          ]}
        >
          <Feather color={theme.info} name="lock" size={ICON.sm} />
          <Text style={[styles.privacyText, { color: theme.textSecondary }]}>
            {Platform.OS === "web"
              ? "Demo handles are temporary and clear when this page reloads. Use sample details only."
              : "Handles stay in this device’s keychain. Dispatch sees the payout rail, never the handle."}
          </Text>
        </View>

        <SectionHeader title="Settlements" />
        {ordered.length === 0 ? (
          <EmptyState
            icon={<Feather color={theme.textMuted} name="file-text" size={36} />}
            message="Settlements appear here once a period closes."
            title="No settlements yet"
          />
        ) : (
          <Card padding="none">
            {ordered.map((payout, index) => (
              <ListRow
                isLast={index === ordered.length - 1}
                key={payout.id}
                onPress={() => setOpenPayout(payout)}
                subtitle={formatPeriod(payout)}
                title={formatCents(payout.netCents)}
                trailing={<StatusBadge size="sm" status={PAYOUT_STATUS_LABELS[payout.status]} />}
              />
            ))}
          </Card>
        )}
      </Screen>

      {toast ? (
        <View
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={[styles.toast, { backgroundColor: theme.surfaceBright, borderColor: theme.border }]}
        >
          <Feather color={theme.success} name="check" size={ICON.sm} />
          <Text style={[styles.toastText, { color: theme.text }]}>{toast}</Text>
        </View>
      ) : null}

      <PayoutMethodSheet
        busy={busy}
        errorMessage={saveError}
        existing={editingRail ? methodForRail(methods, editingRail) : null}
        onClose={() => setEditingRail(null)}
        onRemove={(methodId) => void onRemove(methodId)}
        onSave={(input) => void onSave(input)}
        rail={editingRail}
      />

      <PayoutDetailSheet onClose={() => setOpenPayout(null)} payout={openPayout} />
    </View>
  );
}
