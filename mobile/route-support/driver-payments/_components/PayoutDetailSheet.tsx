import {
  Sheet,
  StatusBadge
} from "@/components/ui";
import type { Payout } from "@/domain/types";
import {
  PAYOUT_STATUS_LABELS,
  RAIL_PRESENTATION,
  formatPeriod
} from "@/route-support/driver-payments/utils";
import { formatCents } from "@/route-support/trip-history/utils";
import { useTheme } from "@/theme";
import { Text, View } from "react-native";
import { TotalRow } from "./PaymentRows";
import { styles } from "./paymentStyles";

export function PayoutDetailSheet({
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
