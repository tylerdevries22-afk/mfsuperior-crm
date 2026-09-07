import Feather from "@expo/vector-icons/Feather";
import { Text, View } from "react-native";

import { DriverAvatar, PayoutRailLogo } from "@/components/operations";
import { Card, EmptyState, ListRow, StatusBadge } from "@/components/ui";
import type { Driver, Payout } from "@/domain/types";
import { PAYOUT_STATUS_LABELS, formatPeriod } from "@/route-support/driver-payments/utils";
import { styles } from "@/route-support/payouts/styles";
import { driverFullName } from "@/route-support/schedule/utils";
import { formatCents } from "@/route-support/trip-history/utils";
import { ICON, useTheme } from "@/theme";

/** The settlement ledger, newest first. Each row opens the settlement detail. */
export function SettlementList({ drivers, onOpen, payouts }: {
  readonly drivers: readonly Driver[];
  readonly onOpen: (payoutId: string) => void;
  readonly payouts: readonly Payout[];
}) {
  const theme = useTheme();

  if (payouts.length === 0) {
    return (
      <EmptyState
        icon={<Feather color={theme.textMuted} name="file-text" size={36} />}
        message="Issue a settlement to start the ledger."
        title="No settlements yet"
      />
    );
  }

  return (
    <Card padding="none">
      {payouts.map((payout, index) => {
        const driver = drivers.find((candidate) => candidate.id === payout.driverId);
        return (
          <ListRow
            isLast={index === payouts.length - 1}
            key={payout.id}
            leading={payout.rail
              ? <PayoutRailLogo rail={payout.rail} size="sm" />
              : driver
              ? <DriverAvatar driver={driver} ring={false} size={36} />
              : <Feather color={theme.textMuted} name="user" size={ICON.md} />}
            onPress={() => onOpen(payout.id)}
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
  );
}
