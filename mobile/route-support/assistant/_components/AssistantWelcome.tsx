import { Feather } from "@expo/vector-icons";
import { Pressable, ScrollView, Text, View } from "react-native";

import { THEME } from "@/theme";

import { st } from "../styles";

/**
 * Ported from the Appliance Diagnostic Systems assistant welcome at
 * 480991b7eb0036e4e85c37d3784b2de2ca97d10d — the logo block with title and
 * subtitle above a horizontal rail of quick-action cards that toggle into the
 * composer. Appliance categories become freight topics.
 */

export interface AssistantQuickAction {
  readonly key: string;
  readonly label: string;
  readonly icon: keyof typeof Feather.glyphMap;
  readonly prompt: string;
}

export const ASSISTANT_QUICK_ACTIONS: readonly AssistantQuickAction[] = [
  { key: "next-stop", label: "Next stop", icon: "map-pin", prompt: "What is my next stop?" },
  { key: "hos", label: "Hours", icon: "clock", prompt: "Explain the HOS clock" },
  { key: "exception", label: "Exceptions", icon: "alert-triangle", prompt: "Any open exceptions?" },
  { key: "capacity", label: "Capacity", icon: "package", prompt: "What capacity is available today?" },
  { key: "edi", label: "Partners", icon: "activity", prompt: "Is partner EDI ready?" },
];

export function AssistantWelcome({
  activeQuickAction,
  onQuickAction,
}: {
  readonly activeQuickAction: string | null;
  readonly onQuickAction: (action: AssistantQuickAction) => void;
}) {
  return (
    <View style={st.welcomeWrap}>
      <View style={st.logoSection}>
        <View style={st.toolStatusAvatar}>
          <Feather color={THEME.primary} name="zap" size={20} />
        </View>
        <Text style={st.welcomeTitle}>Operations Assistant</Text>
        <Text style={st.welcomeSub}>Your freight operations copilot</Text>
      </View>

      <View style={st.quickActions}>
        <ScrollView
          contentContainerStyle={st.quickScroll}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {ASSISTANT_QUICK_ACTIONS.map((action) => {
            const isActive = activeQuickAction === action.key;
            return (
              <Pressable
                accessibilityLabel={action.label}
                accessibilityRole="button"
                key={action.key}
                onPress={() => onQuickAction(action)}
                style={[st.quickCard, isActive && st.quickCardActive]}
              >
                <Feather
                  color={isActive ? THEME.primary : THEME.textSecondary}
                  name={action.icon}
                  size={18}
                />
                <Text style={[st.quickLabel, isActive && st.quickLabelActive]}>{action.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}
