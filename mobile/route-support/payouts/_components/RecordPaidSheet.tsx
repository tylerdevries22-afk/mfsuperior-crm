import { Text, View } from "react-native";

import { PayoutRailLogo } from "@/components/operations";
import { AnimatedButton, Sheet } from "@/components/ui";
import { PAYOUT_RAILS, type PayoutRail } from "@/domain/types";
import { presentationFor } from "@/route-support/driver-payments/utils";
import { styles } from "@/route-support/payouts/detailStyles";
import { useTheme } from "@/theme";

/**
 * Picks the rail a transfer already went out on. This records history; it does
 * not move money, and the note says so where the choice is made rather than
 * somewhere the reader has to go looking for it.
 */
export function RecordPaidSheet({ busy, onClose, onRecord }: {
  readonly busy: boolean;
  readonly onClose: () => void;
  readonly onRecord: (rail: PayoutRail) => void;
}) {
  const theme = useTheme();
  return (
    <Sheet onClose={onClose} title="Which rail was it sent on?" visible>
      <View style={styles.sheetBody}>
        <Text style={[styles.sheetNote, { color: theme.textSecondary }]}>
          This records that a transfer already happened. MF Superior moves no money, and the
          driver&apos;s handle is never shown here.
        </Text>
        {PAYOUT_RAILS.map((rail) => {
          const presentation = presentationFor(rail);
          return (
            <AnimatedButton
              accessibilityLabel={`Record as paid on ${presentation.label}`}
              disabled={busy}
              fullWidth
              icon={<PayoutRailLogo rail={rail} size="sm" />}
              key={rail}
              onPress={() => onRecord(rail)}
              title={presentation.label}
              variant="outline"
            />
          );
        })}
      </View>
    </Sheet>
  );
}
