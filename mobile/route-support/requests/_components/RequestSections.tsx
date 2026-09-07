import Ionicons from "@expo/vector-icons/Ionicons";
import { Text, View } from "react-native";

import { Badge, Card, EmptyState, ListRow, SectionHeader, StatTile, StatusBadge } from "@/components/ui";
import type { CustomerRequest } from "@/domain/types";
import { ICON, useTheme } from "@/theme";

import { styles } from "../styles";

export function RequestsHero() {
  const theme = useTheme();
  return (
    <View style={styles.hero}>
      <Text style={[styles.eyebrow, { color: theme.primaryLight }]}>SERVICE DESK</Text>
      <Text style={[styles.title, { color: theme.text }]}>Tell us what needs to move</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Create a detailed freight request and follow its review status from intake through scheduling.</Text>
    </View>
  );
}

export function RequestStats({ requests }: { readonly requests: readonly CustomerRequest[] }) {
  return (
    <View style={styles.statGrid}>
      <StatTile label="Open" value={String(requests.filter(({ status }) => status !== "closed").length)} />
      <StatTile label="Scheduled" value={String(requests.filter(({ status }) => status === "scheduled").length)} />
      <StatTile label="Total" value={String(requests.length)} />
    </View>
  );
}

export function SubmissionSuccess() {
  const theme = useTheme();
  return (
    <Card variant="tinted">
      <View accessibilityRole="alert" style={styles.successRow}>
        <Ionicons color={theme.success} name="checkmark-circle-outline" size={ICON.lg} />
        <View style={styles.grow}>
          <Text style={[styles.successTitle, { color: theme.text }]}>Request saved</Text>
          <Text style={[styles.successCopy, { color: theme.textSecondary }]}>The operations queue now includes your request.</Text>
        </View>
        <Badge label="Submitted" tone="success" />
      </View>
    </Card>
  );
}

export function RequestHistory({ requests, onCreate }: { readonly requests: readonly CustomerRequest[]; readonly onCreate: () => void }) {
  return (
    <>
      <SectionHeader title="Request history" />
      {requests.length === 0 ? (
        <EmptyState actionLabel="Create request" description="Your submitted service requests will appear here." onAction={onCreate} title="No requests yet" />
      ) : (
        <Card padding="none">
          {requests.map((request, index) => (
            <ListRow isLast={index === requests.length - 1} key={request.id} meta={request.type.replaceAll("_", " ")} subtitle={request.details} title={request.subject} trailing={<StatusBadge size="sm" status={request.status} />} />
          ))}
        </Card>
      )}
    </>
  );
}
