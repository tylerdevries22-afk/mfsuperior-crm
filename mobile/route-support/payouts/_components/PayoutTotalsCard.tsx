import Feather from "@expo/vector-icons/Feather";
import { Text, View } from "react-native";

import { Card } from "@/components/ui";
import { styles } from "@/route-support/payouts/styles";
import { formatCents } from "@/route-support/trip-history/utils";
import { ICON, useTheme } from "@/theme";

/** Outstanding and paid-to-date, with the note that this ledger moves no money. */
export function PayoutTotalsCard({ paidCents, pendingCents }: {
  readonly paidCents: number;
  readonly pendingCents: number;
}) {
  const theme = useTheme();
  return (
    <Card>
      <View style={styles.totalsRow}>
        <Total label="Outstanding" tone="warning" value={formatCents(pendingCents)} />
        <Total label="Paid to date" tone="success" value={formatCents(paidCents)} />
      </View>
      <View style={[styles.privacy, { borderTopColor: theme.border }]}>
        <Feather color={theme.info} name="lock" size={ICON.sm} />
        <Text style={[styles.privacyText, { color: theme.textMuted }]}>
          Recording a settlement as paid is a ledger entry. It moves no money, and a driver&apos;s
          payout handle is never shown here — only the rail it went out on.
        </Text>
      </View>
    </Card>
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

/** Inline alert shown when issuing a settlement was refused. */
export function IssueErrorNotice({ message }: { readonly message: string }) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.error,
        { backgroundColor: theme.dangerMuted, borderColor: theme.tint.danger.medium },
      ]}
    >
      <Feather color={theme.danger} name="alert-circle" size={ICON.sm} />
      <Text style={[styles.errorText, { color: theme.text }]}>{message}</Text>
    </View>
  );
}
