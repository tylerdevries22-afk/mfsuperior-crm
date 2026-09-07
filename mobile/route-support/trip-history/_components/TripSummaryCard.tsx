import Feather from "@expo/vector-icons/Feather";
import { Text, View } from "react-native";

import { Card } from "@/components/ui";
import { formatCents, type TripTotals } from "@/route-support/trip-history/utils";
import { ICON, useTheme } from "@/theme";

import { styles } from "../styles";

/** Loads, miles, and earnings for the selected period. */
export function TripSummaryCard({ totals }: { readonly totals: TripTotals }) {
  const theme = useTheme();
  return (
    <Card>
      <View style={styles.totalsRow}>
        <Total label="Loads" value={String(totals.loads)} />
        <Total label="Miles" value={totals.miles.toLocaleString()} />
        <Total label="Earned" value={formatCents(totals.earningsCents)} />
      </View>
      {totals.onTimeRate !== null ? (
        <View style={[styles.onTimeRow, { borderTopColor: theme.border }]}>
          <Feather
            color={totals.onTimeRate >= 0.95 ? theme.success : theme.warning}
            name="clock"
            size={ICON.sm}
          />
          <Text style={[styles.onTimeText, { color: theme.textSecondary }]}>
            {Math.round(totals.onTimeRate * 100)}% delivered inside the appointment window
          </Text>
        </View>
      ) : null}
      <Text style={[styles.estimateNote, { color: theme.textMuted }]}>
        Earnings are what each load is worth at your pay rate. Your settlement ledger is the
        record of what was paid.
      </Text>
    </Card>
  );
}

function Total({ label, value }: { readonly label: string; readonly value: string }) {
  const theme = useTheme();
  return (
    <View accessibilityLabel={`${value} ${label}`} style={styles.total}>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        numberOfLines={1}
        style={[styles.totalValue, { color: theme.text }]}
      >
        {value}
      </Text>
      <Text style={[styles.totalLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}
