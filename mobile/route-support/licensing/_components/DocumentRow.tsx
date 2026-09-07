import Feather from "@expo/vector-icons/Feather";
import { Text, View } from "react-native";

import { ListRow } from "@/components/ui";
import {
  DOCUMENT_KIND_LABELS,
  describeRemaining,
  type ComplianceEntry,
  type ExpiryBucket,
} from "@/route-support/licensing/utils";
import { ICON, useTheme } from "@/theme";

import { styles } from "../styles";

const BUCKET_TONE: Record<ExpiryBucket, "danger" | "warning" | "info" | "muted"> = {
  expired: "danger",
  ok: "muted",
  soon: "info",
  urgent: "warning",
};

/** One document on file, coloured by how close it is to expiring. */
export function DocumentRow({
  entry,
  isLast,
  onPress,
}: {
  readonly entry: ComplianceEntry;
  readonly isLast: boolean;
  readonly onPress?: () => void;
}) {
  const theme = useTheme();
  const tone = BUCKET_TONE[entry.bucket];
  const color = tone === "muted" ? theme.textMuted : theme[tone];

  return (
    <ListRow
      isLast={isLast}
      leading={
        <View style={[styles.kindWell, { backgroundColor: theme.surfaceElevated }]}>
          <Feather
            color={color}
            name={entry.document.subjectType === "vehicle" ? "truck" : "user"}
            size={ICON.md}
          />
        </View>
      }
      onPress={onPress}
      rich
      subtitle={`${entry.subjectLabel} · ${entry.document.identifier}`}
      title={DOCUMENT_KIND_LABELS[entry.document.kind]}
      trailing={
        <View style={styles.trailing}>
          <Text style={[styles.remaining, { color }]}>
            {describeRemaining(entry.daysRemaining)}
          </Text>
          <Text style={[styles.expiryDate, { color: theme.textMuted }]}>
            {new Date(entry.document.expiresOn).toLocaleDateString()}
          </Text>
        </View>
      }
    />
  );
}
