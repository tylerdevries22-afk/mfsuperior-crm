import { Text, View } from "react-native";

import { AnimatedPressable, WorkspaceCard } from "@/components/ui";

import { adminS } from "../homeStyles";
import type { AttentionItem } from "../useAdminHomeData";

/** The queue of things a dispatcher has to act on, each with its own way in. */
export function AttentionCard({ items }: { readonly items: readonly AttentionItem[] }) {
  return (
    <WorkspaceCard title="Needs your attention">
      {items.map((row) => (
        <View key={row.key} style={adminS.attentionRow}>
          <View style={adminS.attentionCopy}>
            <Text style={adminS.attentionTitle}>{row.title}</Text>
            <Text style={adminS.attentionHint}>{row.hint}</Text>
          </View>
          <AnimatedPressable
            accessibilityLabel={row.title}
            accessibilityRole="button"
            haptic="selection"
            onPress={row.onPress}
            style={adminS.attentionButton}
          >
            <Text style={adminS.attentionButtonText}>Review</Text>
          </AnimatedPressable>
        </View>
      ))}
    </WorkspaceCard>
  );
}
