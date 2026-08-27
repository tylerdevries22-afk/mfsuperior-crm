import Feather from "@expo/vector-icons/Feather";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  AnimatedPressable,
  Card,
  EmptyState,
  Header,
  ListRow,
  Screen,
  SectionHeader,
  Sheet,
  StatusBadge,
} from "@/components/ui";
import { PayoutRailLogo } from "@/components/operations";
import type { Payout, PayoutMethod, PayoutMethodInput, PayoutRail } from "@/domain/types";
import { PayoutMethodSheet } from "@/route-support/driver-payments/_components/PayoutMethodSheet";
import {
  PAYOUT_STATUS_LABELS,
  RAIL_PRESENTATION,
  formatPeriod,
  methodForRail,
  payoutHandoffUrl,
  sortPayouts,
  summarizeEarnings,
} from "@/route-support/driver-payments/utils";
import { formatCents } from "@/route-support/trip-history/utils";
import { useOperations } from "@/store";
import { ICON, RADIUS, SPACE, TYPO, useTheme } from "@/theme";

export default function DriverPaymentsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { actions, currentDriver, effectiveRole, payouts } = useOperations();

  const [methods, setMethods] = useState<readonly PayoutMethod[]>([]);
  const [editingRail, setEditingRail] = useState<PayoutRail | null>(null);
  const [openPayout, setOpenPayout] = useState<Payout | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const isDriver = effectiveRole === "driver" && currentDriver !== null;

  const refreshMethods = useCallback(async () => {
    if (!isDriver) {
      return;
    }
    setMethods(await actions.listPayoutMethods());
  }, [actions, isDriver]);

  useEffect(() => { void refreshMethods(); }, [refreshMethods]);

  // A confirmation that clears itself; a copied handle needs acknowledging,
  // not dismissing.
  useEffect(() => {
    if (!toast) {
      return undefined;
    }
    const timer = setTimeout(() => setToast(null), 2_200);
    return () => clearTimeout(timer);
  }, [toast]);

  const summary = useMemo(() => summarizeEarnings(payouts), [payouts]);
  const ordered = useMemo(() => sortPayouts(payouts), [payouts]);

  const onSave = useCallback(async (input: PayoutMethodInput) => {
    setBusy(true);
    setSaveError(null);
    const saved = await actions.savePayoutMethod(input);
    setBusy(false);
    if (!saved) {
      // The repository rejected the handle. Its message is already safe to
      // show, so surface it on the field rather than closing over the mistake.
      setSaveError("That handle is not valid for this app. Check the format and try again.");
      return;
    }
    await refreshMethods();
    setEditingRail(null);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, [actions, refreshMethods]);

  const onRemove = useCallback(async (methodId: string) => {
    setBusy(true);
    await actions.removePayoutMethod(methodId);
    setBusy(false);
    await refreshMethods();
    setEditingRail(null);
  }, [actions, refreshMethods]);

  const onSetDefault = useCallback(async (methodId: string) => {
    void Haptics.selectionAsync().catch(() => undefined);
    await actions.setDefaultPayoutMethod(methodId);
    await refreshMethods();
  }, [actions, refreshMethods]);

  const onCopy = useCallback(async (method: PayoutMethod) => {
    await Clipboard.setStringAsync(method.handle);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    setToast("Handle copied");
  }, []);

  const onOpenApp = useCallback(async (method: PayoutMethod) => {
    const url = payoutHandoffUrl(method.rail, method.handle);
    if (!url) {
      return;
    }
    const supported = await Linking.canOpenURL(url).catch(() => false);
    if (!supported) {
      setToast("That app is not installed on this device");
      return;
    }
    await Linking.openURL(url);
  }, []);

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
            Handles stay in this device&apos;s keychain. Dispatch sees only which rail a settlement
            went out on, never the handle itself.
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

function RailRow({
  isLast,
  method,
  onCopy,
  onEdit,
  onOpenApp,
  onSetDefault,
  presentation,
}: {
  readonly isLast: boolean;
  readonly method: PayoutMethod | null;
  readonly onCopy: () => void;
  readonly onEdit: () => void;
  readonly onOpenApp: () => void;
  readonly onSetDefault: () => void;
  readonly presentation: (typeof RAIL_PRESENTATION)[number];
}) {
  const theme = useTheme();
  const canOpen = method !== null && presentation.deepLink !== null;

  return (
    <View style={[styles.railRow, !isLast && { borderBottomColor: theme.border, borderBottomWidth: 1 }]}>
      <AnimatedPressable
        accessibilityLabel={method
          ? `${presentation.label}, ${method.handle}${method.isDefault ? ", default payout" : ""}. Edit.`
          : `Add a ${presentation.label} handle`}
        haptic="selection"
        onPress={onEdit}
        style={styles.railMain}
      >
        <PayoutRailLogo rail={presentation.rail} />
        <View style={styles.grow}>
          <View style={styles.railTitleRow}>
            <Text style={[styles.railTitle, { color: theme.text }]}>{presentation.label}</Text>
            {method?.isDefault ? <StatusBadge showDot={false} size="sm" status="default" /> : null}
          </View>
          <Text
            numberOfLines={1}
            style={[styles.railHandle, { color: method ? theme.textSecondary : theme.textMuted }]}
          >
            {method?.handle ?? "Not set up"}
          </Text>
        </View>
        <Feather color={theme.textMuted} name={method ? "edit-2" : "plus"} size={ICON.sm} />
      </AnimatedPressable>

      {method ? (
        <View style={styles.quickActions}>
          <QuickAction icon="copy" label={`Copy ${presentation.label} handle`} onPress={onCopy} title="Copy" />
          {canOpen ? (
            <QuickAction
              icon="external-link"
              label={`Open ${presentation.label}`}
              onPress={onOpenApp}
              title="Open app"
            />
          ) : null}
          {method.isDefault ? null : (
            <QuickAction
              icon="star"
              label={`Make ${presentation.label} my default payout`}
              onPress={onSetDefault}
              title="Make default"
            />
          )}
        </View>
      ) : null}
    </View>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
  title,
}: {
  readonly icon: keyof typeof Feather.glyphMap;
  readonly label: string;
  readonly onPress: () => void;
  readonly title: string;
}) {
  const theme = useTheme();
  return (
    <AnimatedPressable
      accessibilityLabel={label}
      haptic="light"
      onPress={onPress}
      style={[styles.quickAction, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
    >
      <Feather color={theme.primaryLight} name={icon} size={ICON.xs} />
      <Text style={[styles.quickActionText, { color: theme.text }]}>{title}</Text>
    </AnimatedPressable>
  );
}

function PayoutDetailSheet({
  onClose,
  payout,
}: {
  readonly onClose: () => void;
  readonly payout: Payout | null;
}) {
  const theme = useTheme();
  if (!payout) {
    return null;
  }
  return (
    <Sheet onClose={onClose} title={`Settlement · ${formatPeriod(payout)}`} visible>
      <View style={styles.detail}>
        <View style={styles.detailHeader}>
          <Text style={[styles.detailNet, { color: theme.text }]}>{formatCents(payout.netCents)}</Text>
          <StatusBadge status={PAYOUT_STATUS_LABELS[payout.status]} />
        </View>
        {payout.rail ? (
          <Text style={[styles.detailMeta, { color: theme.textSecondary }]}>
            Sent on {RAIL_PRESENTATION.find((entry) => entry.rail === payout.rail)?.label ?? payout.rail}
            {payout.paidAt ? ` · ${new Date(payout.paidAt).toLocaleDateString()}` : ""}
          </Text>
        ) : null}

        <View style={[styles.lineItems, { borderColor: theme.border }]}>
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
              <Text style={[styles.lineItemText, { color: theme.textSecondary }]}>
                {lineItem.description}
              </Text>
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
        </View>

        <View style={styles.totalsBlock}>
          <TotalRow label="Gross" value={formatCents(payout.grossCents)} />
          <TotalRow label="Deductions" tone="danger" value={`−${formatCents(payout.deductionCents)}`} />
          <TotalRow bold label="Net" value={formatCents(payout.netCents)} />
        </View>
      </View>
    </Sheet>
  );
}

function TotalRow({
  bold,
  label,
  tone,
  value,
}: {
  readonly bold?: boolean;
  readonly label: string;
  readonly tone?: "danger";
  readonly value: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.totalRow}>
      <Text style={[styles.totalLabel, { color: theme.textSecondary }, bold && { color: theme.text }]}>
        {label}
      </Text>
      <Text
        style={[
          styles.totalValue,
          { color: tone === "danger" ? theme.danger : theme.text },
          bold && styles.totalValueBold,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function Earning({
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
    <View accessibilityLabel={`${label} ${value}`} style={styles.earning}>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        numberOfLines={1}
        style={[styles.earningValue, { color: theme[tone] }]}
      >
        {value}
      </Text>
      <Text style={[styles.earningLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  detail: { gap: SPACE.md, paddingBottom: SPACE.md },
  detailHeader: { alignItems: "center", flexDirection: "row", gap: SPACE.sm, justifyContent: "space-between" },
  detailMeta: { ...TYPO.caption },
  detailNet: { ...TYPO.metric },
  earning: { flex: 1, gap: 2 },
  earningLabel: { ...TYPO.metricLabel },
  earningValue: { ...TYPO.metric, fontSize: 24, lineHeight: 28 },
  earningsRow: { flexDirection: "row", gap: SPACE.md },
  fill: { flex: 1 },
  grow: { flex: 1, minWidth: 0 },
  lineItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACE.sm,
    justifyContent: "space-between",
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
  },
  lineItemAmount: { ...TYPO.captionStrong },
  lineItemText: { ...TYPO.caption, flex: 1 },
  lineItems: { borderRadius: RADIUS.md, borderWidth: 1, overflow: "hidden" },
  nextNote: { ...TYPO.caption },
  privacy: {
    alignItems: "flex-start",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACE.sm,
    padding: SPACE.md,
  },
  privacyText: { ...TYPO.caption, flex: 1 },
  quickAction: {
    alignItems: "center",
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACE.xxs,
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xxs,
  },
  quickActionText: { ...TYPO.subtitle },
  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACE.xs,
    paddingBottom: SPACE.sm,
    paddingLeft: 56,
    paddingRight: SPACE.md,
  },
  railHandle: { ...TYPO.caption, marginTop: 2 },
  railMain: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACE.md,
    minHeight: 72,
    paddingHorizontal: SPACE.md,
  },
  railRow: { gap: 0 },
  railTitle: { ...TYPO.rowTitle },
  railTitleRow: { alignItems: "center", flexDirection: "row", gap: SPACE.xs },
  toast: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    bottom: 40,
    flexDirection: "row",
    gap: SPACE.xs,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    position: "absolute",
  },
  toastText: { ...TYPO.caption },
  totalLabel: { ...TYPO.caption },
  totalRow: { flexDirection: "row", justifyContent: "space-between" },
  totalValue: { ...TYPO.caption },
  totalValueBold: { ...TYPO.rowTitle },
  totalsBlock: { gap: SPACE.xs },
});
