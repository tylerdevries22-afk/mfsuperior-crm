import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  Card,
  EmptyState,
  Header,
  ListRow,
  Screen,
  SectionHeader,
  SegmentedControl,
} from "@/components/ui";
import {
  DOCUMENT_KIND_LABELS,
  EXPIRY_BUCKET_LABELS,
  buildComplianceEntries,
  countNeedingAttention,
  describeRemaining,
  groupByBucket,
  type ComplianceEntry,
  type ExpiryBucket,
} from "@/route-support/licensing/utils";
import { useOperations } from "@/store";
import { ICON, RADIUS, SPACE, TYPO, useTheme } from "@/theme";

type SubjectFilter = "all" | "vehicle" | "driver";

const FILTER_OPTIONS = [
  { label: "All", value: "all" as const },
  { label: "Vehicles", value: "vehicle" as const },
  { label: "Drivers", value: "driver" as const },
];

const BUCKET_TONE: Record<ExpiryBucket, "danger" | "warning" | "info" | "muted"> = {
  expired: "danger",
  ok: "muted",
  soon: "info",
  urgent: "warning",
};

export default function LicensingScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { complianceDocuments, effectiveRole, state, vehicles } = useOperations();
  const [filter, setFilter] = useState<SubjectFilter>("all");

  const entries = useMemo(
    () => buildComplianceEntries(complianceDocuments, vehicles, state.drivers),
    [complianceDocuments, state.drivers, vehicles],
  );
  const visible = useMemo(
    () => filter === "all"
      ? entries
      : entries.filter((entry) => entry.document.subjectType === filter),
    [entries, filter],
  );
  const groups = useMemo(() => groupByBucket(visible), [visible]);
  const attention = useMemo(() => countNeedingAttention(entries), [entries]);

  if (effectiveRole !== "admin") {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]}>
        <Header onBack={() => router.back()} showBack title="Licensing & registration" />
        <Screen safeEdges={["left", "right", "bottom"]}>
          <EmptyState
            icon={<Feather color={theme.textMuted} name="file-text" size={36} />}
            message="The compliance register is an admin console. Switch to an admin account to open it."
            title="Admin role required"
          />
        </Screen>
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Header
        centered
        onBack={() => router.back()}
        showBack
        subtitle={`${entries.length} documents on file`}
        title="Licensing & registration"
      />
      <Screen contentContainerStyle={styles.content} safeEdges={["left", "right", "bottom"]} scroll>
        {attention > 0 ? (
          <View
            accessibilityRole="alert"
            style={[
              styles.banner,
              { backgroundColor: theme.warningMuted, borderColor: theme.tint.warning.medium },
            ]}
          >
            <Feather color={theme.warning} name="alert-triangle" size={ICON.md} />
            <View style={styles.grow}>
              <Text style={[styles.bannerTitle, { color: theme.text }]}>
                {attention} document{attention === 1 ? "" : "s"} need attention
              </Text>
              <Text style={[styles.bannerBody, { color: theme.textSecondary }]}>
                Expired or expiring within thirty days. A unit running on expired paper is a
                roadside out-of-service order.
              </Text>
            </View>
          </View>
        ) : (
          <View
            style={[
              styles.banner,
              { backgroundColor: theme.successMuted, borderColor: theme.tint.success.medium },
            ]}
          >
            <Feather color={theme.success} name="check-circle" size={ICON.md} />
            <Text style={[styles.bannerTitle, { color: theme.text }]}>
              Everything on file is current.
            </Text>
          </View>
        )}

        <SegmentedControl
          accessibilityLabel="Filter compliance documents"
          onChange={setFilter}
          options={FILTER_OPTIONS}
          value={filter}
        />

        {groups.length === 0 ? (
          <EmptyState
            icon={<Feather color={theme.textMuted} name="file-text" size={36} />}
            message="No documents match this filter."
            title="Nothing here"
          />
        ) : (
          groups.map((group) => (
            <View key={group.bucket} style={styles.group}>
              <SectionHeader title={EXPIRY_BUCKET_LABELS[group.bucket]} />
              <Card padding="none">
                {group.entries.map((entry, index) => (
                  <DocumentRow
                    entry={entry}
                    isLast={index === group.entries.length - 1}
                    key={entry.document.id}
                    onPress={entry.document.subjectType === "vehicle"
                      ? () => router.push({
                          params: { id: entry.document.subjectId },
                          pathname: "/fleet/[id]",
                        })
                      : undefined}
                  />
                ))}
              </Card>
            </View>
          ))
        )}
      </Screen>
    </View>
  );
}

function DocumentRow({
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

const styles = StyleSheet.create({
  banner: {
    alignItems: "flex-start",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACE.sm,
    padding: SPACE.md,
  },
  bannerBody: { ...TYPO.caption, marginTop: 2 },
  bannerTitle: { ...TYPO.captionStrong },
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  expiryDate: { ...TYPO.subtitle },
  fill: { flex: 1 },
  group: { gap: SPACE.xs },
  grow: { flex: 1, minWidth: 0 },
  kindWell: { alignItems: "center", borderRadius: 12, height: 40, justifyContent: "center", width: 40 },
  remaining: { ...TYPO.captionStrong, textAlign: "right" },
  trailing: { alignItems: "flex-end", gap: 2, maxWidth: 128 },
});
