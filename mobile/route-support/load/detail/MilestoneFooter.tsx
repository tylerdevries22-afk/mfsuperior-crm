import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Card } from "@/components/ui";
import type { ShipmentStop } from "@/domain/types";
import type { LoadLifecycleAction } from "@/lib/load-actions";
import { formatAppointment } from "@/lib/operations-format";
import { SPACE, TYPO, useTheme } from "@/theme";

interface Props {
  action: LoadLifecycleAction | null;
  intermediateStop?: ShipmentStop;
  busyAction: string | null;
  hasDriver: boolean;
  onAdvance: () => void;
  onAdvanceStop: (stop: ShipmentStop) => Promise<void>;
}

/** A sibling of the detail scroller: reserves its own space above the home indicator. */
export function MilestoneFooter({ action, intermediateStop, busyAction, hasDriver, onAdvance, onAdvanceStop }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const compactHeight = useWindowDimensions().height < 400;
  if (!action && !intermediateStop) return null;
  const needsDriver = action?.nextStatus === "dispatched" && !hasDriver;
  const title = intermediateStop
    ? intermediateStop.status === "pending" ? "Arrive at intermediate stop" : "Complete intermediate stop"
    : action?.label ?? "";
  const busyKey = intermediateStop ? `stop-${intermediateStop.id}` : action?.nextStatus;
  return (
    <View
      testID="load-milestone-footer"
      style={[styles.footer, {
        backgroundColor: theme.background,
        borderTopColor: theme.border,
        paddingTop: compactHeight ? SPACE.xs : SPACE.sm,
        paddingBottom: Math.max(insets.bottom, compactHeight ? SPACE.xs : SPACE.sm),
        paddingLeft: Math.max(insets.left, compactHeight ? SPACE.md : SPACE.lg),
        paddingRight: Math.max(insets.right, compactHeight ? SPACE.md : SPACE.lg),
      }]}
    >
      <Card padding="compact" style={compactHeight && styles.compactCard} title={intermediateStop ? "Next route milestone" : "Next milestone"}>
        {intermediateStop ? <Text style={[styles.description, { color: theme.textSecondary }]}>{intermediateStop.facilityName} · {formatAppointment(intermediateStop.appointment)}</Text> : null}
        {needsDriver ? <Text style={[styles.description, { color: theme.textSecondary }]}>Assign a driver to dispatch this load.</Text> : null}
        <Button
          disabled={needsDriver || busyAction !== null}
          fullWidth
          loading={busyAction !== null && busyAction === busyKey}
          onPress={intermediateStop ? () => void onAdvanceStop(intermediateStop) : onAdvance}
          title={title}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { flexShrink: 0, borderTopWidth: StyleSheet.hairlineWidth },
  compactCard: { padding: SPACE.sm, gap: SPACE.xs },
  description: { ...TYPO.caption },
});
