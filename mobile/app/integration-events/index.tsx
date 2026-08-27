import { useRouter } from "expo-router";

import { EmptyState, Header, Screen } from "@/components/ui";
import { FreightCollectionScreen } from "@/route-support/freight";
import { INTEGRATION_EVENTS_SPEC } from "@/features/freight-screen-specs";
import { useOperations } from "@/store";
import { useTheme } from "@/theme";

export default function IntegrationEventsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { effectiveRole } = useOperations();
  if (effectiveRole !== "admin") {
    return (
      <Screen safeEdges={["left", "right", "bottom"]}>
        <Header onBack={() => router.back()} showBack title="Integration events" />
        <EmptyState
          message="Integration events are available to admin users only."
          style={{ backgroundColor: theme.background }}
          title="Admin role required"
        />
      </Screen>
    );
  }
  return <FreightCollectionScreen spec={INTEGRATION_EVENTS_SPEC} />;
}
