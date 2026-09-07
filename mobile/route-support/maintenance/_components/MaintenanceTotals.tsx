import { Text, View } from "react-native";

import { useTheme } from "@/theme";

import { styles } from "../styles";

/** The three counters above the shop board. */
export function MaintenanceTotals({
  critical,
  open,
  scheduled,
}: {
  readonly critical: number;
  readonly open: number;
  readonly scheduled: number;
}) {
  return (
    <View style={styles.totalsRow}>
      <Total label="Open" value={open} />
      <Total label="Scheduled" value={scheduled} />
      <Total
        label="Critical"
        tone={critical > 0 ? "danger" : undefined}
        value={critical}
      />
    </View>
  );
}

function Total({
  label,
  tone,
  value,
}: {
  readonly label: string;
  readonly tone?: "danger";
  readonly value: number;
}) {
  const theme = useTheme();
  return (
    <View
      accessibilityLabel={`${value} ${label}`}
      style={[styles.total, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <Text
        style={[
          styles.totalValue,
          { color: tone === "danger" && value > 0 ? theme.danger : theme.text },
        ]}
      >
        {value}
      </Text>
      <Text style={[styles.totalLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}
