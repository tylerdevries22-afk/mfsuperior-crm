import { PayoutRailLogo } from "@/components/operations";
import {
  AnimatedPressable,
  StatusBadge
} from "@/components/ui";
import type { PayoutMethod } from "@/domain/types";
import {
  RAIL_PRESENTATION
} from "@/route-support/driver-payments/utils";
import { ICON, useTheme } from "@/theme";
import Feather from "@expo/vector-icons/Feather";
import { Text, View } from "react-native";
import { styles } from "./paymentStyles";

export function RailRow({
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

export function QuickAction({
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

export function TotalRow({
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

export function Earning({
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
