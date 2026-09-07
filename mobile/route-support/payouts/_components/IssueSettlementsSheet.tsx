import { Text, View } from "react-native";

import { DriverAvatar } from "@/components/operations";
import { ListRow, Sheet } from "@/components/ui";
import { styles } from "@/route-support/payouts/styles";
import type { IssueDraft } from "@/route-support/payouts/useIssueDrafts";
import { formatSettlementPeriod, type SettlementPeriod } from "@/route-support/payouts/utils";
import { driverFullName } from "@/route-support/schedule/utils";
import { formatCents } from "@/route-support/trip-history/utils";
import { useTheme } from "@/theme";

/**
 * One row per driver, each previewing that driver's own next period. A driver
 * with nothing left to settle stays visible but unselectable, so the sheet
 * reads as the full roster rather than a list that silently drops people.
 */
export function IssueSettlementsSheet({ busyDriverId, drafts, onClose, onIssue }: {
  readonly busyDriverId: string | null;
  readonly drafts: readonly IssueDraft[];
  readonly onClose: () => void;
  readonly onIssue: (driverId: string, period: SettlementPeriod) => void;
}) {
  const theme = useTheme();
  return (
    <Sheet onClose={onClose} title="Issue settlements" visible>
      <View style={styles.sheetBody}>
        {drafts.map((draft, index) => {
          // Bound to a local so the closure below keeps the non-null narrowing.
          const period = draft.period;
          return (
            <ListRow
              disabled={busyDriverId !== null || period === null}
              isLast={index === drafts.length - 1}
              key={draft.driver.id}
              leading={<DriverAvatar driver={draft.driver} ring={false} size={36} />}
              onPress={period ? () => onIssue(draft.driver.id, period) : undefined}
              rich
              subtitle={period
                ? `${formatSettlementPeriod(period)} · ${draft.lineItems.length} line items`
                : "Everything delivered is already settled"}
              title={driverFullName(draft.driver)}
              trailing={
                <Text
                  style={[
                    styles.net,
                    { color: period ? theme.text : theme.textMuted },
                  ]}
                >
                  {formatCents(draft.totals.netCents)}
                </Text>
              }
            />
          );
        })}
      </View>
    </Sheet>
  );
}
