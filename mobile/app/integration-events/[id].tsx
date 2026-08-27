import { useLocalSearchParams, useRouter } from "expo-router";
import { EmptyState, Header, Screen } from "@/components/ui";
import { createFreightDetailSpec } from "@/features/freight-detail-specs";
import { FreightDetailScreen } from "@/route-support/freight";
import { useOperations } from "@/store";
import { useTheme } from "@/theme";

export default function IntegrationEventDetailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { effectiveRole } = useOperations();
  const { id } = useLocalSearchParams<{ id: string }>();
  if (effectiveRole !== "admin") {
    return (
      <Screen safeEdges={["left", "right", "bottom"]}>
        <Header onBack={() => router.back()} showBack title="Integration event" />
        <EmptyState
          message="Integration events are available to admin users only."
          style={{ backgroundColor: theme.background }}
          title="Admin role required"
        />
      </Screen>
    );
  }
  return <FreightDetailScreen spec={createFreightDetailSpec("event", id)} />;
}
