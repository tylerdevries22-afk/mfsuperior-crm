import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { Card, PressableSurface, StatusBadge } from "@/components/ui";
import type { Shipment, ShipmentStop } from "@/domain/types";
import { formatAppointment, shipmentProgress, shipmentRoute } from "@/lib/operations-format";
import { ICON, RADIUS, SPACE, TYPO, useTheme } from "@/theme";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

export function ProgressTrack({ value, tone = "brand" }: { readonly value: number; readonly tone?: "brand" | "success" | "warning" }) {
  const theme = useTheme();
  const progress = Math.max(0, Math.min(1, value));
  const color = tone === "success" ? theme.success : tone === "warning" ? theme.warning : theme.primary;
  return (
    <View
      accessibilityLabel={`${Math.round(progress * 100)} percent complete`}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      style={[styles.track, { backgroundColor: theme.surfaceBright }]}
    >
      <View style={[styles.trackFill, { backgroundColor: color, width: `${progress * 100}%` }]} />
    </View>
  );
}

export function ShipmentCard({
  shipment,
  onPress,
  footer,
}: {
  readonly shipment: Shipment;
  readonly onPress?: () => void;
  readonly footer?: ReactNode;
}) {
  const theme = useTheme();
  const firstStop = shipment.stops[0];
  return (
    <Card
      accessibilityLabel={`Load ${shipment.loadNumber}, ${shipmentRoute(shipment)}, ${shipment.status.replaceAll("_", " ")}, ${Math.round(shipmentProgress(shipment.status) * 100)} percent complete`}
      onPress={onPress}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.iconMark, { backgroundColor: theme.primaryMuted }]}>
          <Ionicons color={theme.primaryLight} name="cube-outline" size={ICON.md} />
        </View>
        <View style={styles.grow}>
          <Text style={[styles.loadId, { color: theme.text }]}>{shipment.loadNumber}</Text>
          <Text style={[styles.route, { color: theme.textSecondary }]}>{shipmentRoute(shipment)}</Text>
        </View>
        <StatusBadge status={shipment.status} />
      </View>
      <ProgressTrack value={shipmentProgress(shipment.status)} tone={shipment.status === "exception" ? "warning" : "brand"} />
      <View style={styles.metaRow}>
        <Text style={[styles.meta, { color: theme.textMuted }]}>
          {firstStop ? formatAppointment(firstStop.appointment) : "Appointment pending"}
        </Text>
        <Text style={[styles.meta, { color: theme.textMuted }]}>
          {shipment.distanceMiles.toLocaleString()} mi · {shipment.palletCount} pallets
        </Text>
      </View>
      {footer}
    </Card>
  );
}

export interface WorkspaceAction {
  readonly key: string;
  readonly label: string;
  readonly detail?: string;
  readonly icon: IoniconName;
  readonly tone?: "brand" | "success" | "warning" | "info";
  readonly onPress: () => void;
}

export function WorkspaceGrid({ actions, style }: { readonly actions: readonly WorkspaceAction[]; readonly style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const tones = {
    brand: { color: theme.primaryLight, backgroundColor: theme.primaryMuted },
    success: { color: theme.success, backgroundColor: theme.successMuted },
    warning: { color: theme.warning, backgroundColor: theme.warningMuted },
    info: { color: theme.info, backgroundColor: theme.infoMuted },
  } as const;

  return (
    <View style={[styles.grid, style]}>
      {actions.map((action) => {
        const tone = tones[action.tone ?? "brand"];
        return (
          <PressableSurface
            accessibilityLabel={action.detail ? `${action.label}, ${action.detail}` : action.label}
            haptic="selection"
            key={action.key}
            onPress={action.onPress}
            style={[styles.workspace, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <View style={[styles.workspaceIcon, { backgroundColor: tone.backgroundColor }]}>
              <Ionicons color={tone.color} name={action.icon} size={ICON.lg} />
            </View>
            <Text style={[styles.workspaceLabel, { color: theme.text }]}>{action.label}</Text>
            {action.detail ? <Text style={[styles.workspaceDetail, { color: theme.textMuted }]}>{action.detail}</Text> : null}
          </PressableSurface>
        );
      })}
    </View>
  );
}

export function StopTimeline({ stops, onStopPress }: { readonly stops: readonly ShipmentStop[]; readonly onStopPress?: (stop: ShipmentStop) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.stopList}>
      {stops.map((stop, index) => {
        const complete = stop.status === "completed";
        const active = stop.status === "arrived";
        const dotColor = complete ? theme.success : active ? theme.primary : theme.textMuted;
        const content = (
          <View style={styles.stopRow}>
            <View style={styles.stopRail}>
              <View style={[styles.stopDot, { backgroundColor: dotColor }]} />
              {index < stops.length - 1 ? <View style={[styles.stopLine, { backgroundColor: theme.borderLight }]} /> : null}
            </View>
            <View style={styles.stopCopy}>
              <View style={styles.stopTitleRow}>
                <Text style={[styles.stopSequence, { color: theme.primaryLight }]}>{String(stop.sequence).padStart(2, "0")}</Text>
                <Text numberOfLines={1} style={[styles.stopTitle, { color: theme.text }]}>{stop.facilityName}</Text>
                <StatusBadge size="sm" status={stop.status} />
              </View>
              <Text style={[styles.stopMeta, { color: theme.textSecondary }]}>{stop.address.city}, {stop.address.state} · {formatAppointment(stop.appointment)}</Text>
              <Text numberOfLines={2} style={[styles.stopInstructions, { color: theme.textMuted }]}>{stop.instructions}</Text>
            </View>
          </View>
        );

        if (!onStopPress) return <View key={stop.id}>{content}</View>;
        return (
          <PressableSurface accessibilityLabel={`Open ${stop.facilityName}`} haptic="selection" key={stop.id} onPress={() => onStopPress(stop)}>
            {content}
          </PressableSurface>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  cardHeader: { alignItems: "center", flexDirection: "row", gap: SPACE.sm },
  grow: { flex: 1, gap: 2, minWidth: 0 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  iconMark: { alignItems: "center", borderRadius: RADIUS.sm, height: 42, justifyContent: "center", width: 42 },
  loadId: { ...TYPO.cardTitle },
  meta: { ...TYPO.caption },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm, justifyContent: "space-between" },
  route: { ...TYPO.caption },
  stopCopy: { flex: 1, gap: SPACE.xxs, paddingBottom: SPACE.md },
  stopDot: { borderRadius: RADIUS.pill, height: 12, width: 12 },
  stopInstructions: { ...TYPO.caption },
  stopLine: { flex: 1, marginVertical: SPACE.xxs, width: 2 },
  stopList: { gap: SPACE.xxs },
  stopMeta: { ...TYPO.caption },
  stopRail: { alignItems: "center", width: 18 },
  stopRow: { flexDirection: "row", gap: SPACE.sm, minHeight: 92 },
  stopSequence: { ...TYPO.label },
  stopTitle: { ...TYPO.rowTitle, flex: 1 },
  stopTitleRow: { alignItems: "center", flexDirection: "row", gap: SPACE.sm },
  track: { borderRadius: RADIUS.pill, height: 7, overflow: "hidden" },
  trackFill: { borderRadius: RADIUS.pill, height: "100%" },
  workspace: { borderRadius: RADIUS.md, borderWidth: 1, flexBasis: "47%", flexGrow: 1, gap: SPACE.sm, minHeight: 134, padding: SPACE.md },
  workspaceDetail: { ...TYPO.caption },
  workspaceIcon: { alignItems: "center", borderRadius: RADIUS.sm, height: 44, justifyContent: "center", width: 44 },
  workspaceLabel: { ...TYPO.cardTitle },
});
