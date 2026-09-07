import { Text, View } from "react-native";

import { Card, statusLabel } from "@/components/ui";
import type { PayoutLineItem } from "@/domain/types";
import { styles } from "@/route-support/payouts/detailStyles";
import { formatCents } from "@/route-support/trip-history/utils";
import { HAIRLINE, useTheme } from "@/theme";

/** Every line that made up the settlement, with deductions signed. */
export function PayoutLineItems({ lineItems }: {
  readonly lineItems: readonly PayoutLineItem[];
}) {
  const theme = useTheme();
  return (
    <Card padding="none">
      {lineItems.map((lineItem, index) => (
        <View
          key={lineItem.id}
          style={[
            styles.lineItem,
            index < lineItems.length - 1 && {
              borderBottomColor: theme.separator,
              borderBottomWidth: HAIRLINE,
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
  );
}
