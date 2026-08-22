import { Feather } from "@expo/vector-icons";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";

import { THEME } from "@/theme";

import { st } from "../styles";

/**
 * Ported from the Appliance Diagnostic Systems assistant input bar at
 * 480991b7eb0036e4e85c37d3784b2de2ca97d10d: the suggested-reply rail above a
 * rounded composer with a leading icon action and a send button that disables
 * while empty or streaming, and the same keyboard/tab-bar inset behaviour.
 */
export function AssistantInputBar({
  keyboardVisible,
  insets,
  tabBarHeight,
  suggestedReplies,
  onSuggestion,
  onSend,
  streaming,
  value,
  onChangeText,
}: {
  readonly keyboardVisible: boolean;
  readonly insets: EdgeInsets;
  readonly tabBarHeight: number;
  readonly suggestedReplies: readonly string[];
  readonly onSuggestion: (reply: string) => void;
  readonly onSend: (text: string) => void;
  readonly streaming: boolean;
  readonly value: string;
  readonly onChangeText: (next: string) => void;
}) {
  const canSend = value.trim().length > 0 && !streaming;

  return (
    <View
      style={[
        st.bottomBar,
        {
          paddingBottom: keyboardVisible
            ? Math.max(insets.bottom, 8)
            : Platform.OS === "ios"
              ? tabBarHeight + 4
              : 12,
        },
      ]}
    >
      {suggestedReplies.length > 0 && !streaming ? (
        <ScrollView
          contentContainerStyle={st.suggestionsScroll}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={st.suggestionsBar}
        >
          {suggestedReplies.map((reply) => (
            <Pressable
              accessibilityLabel={`Ask: ${reply}`}
              accessibilityRole="button"
              key={reply}
              onPress={() => onSuggestion(reply)}
              style={st.suggestionPill}
            >
              <Text style={st.suggestionText}>{reply}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <View style={st.inputRow}>
        <TextInput
          accessibilityLabel="Message the operations assistant"
          multiline
          onChangeText={onChangeText}
          onSubmitEditing={() => {
            if (canSend) onSend(value);
          }}
          placeholder="Ask about loads, hours, or exceptions"
          placeholderTextColor={THEME.textMuted}
          style={st.textInput}
          value={value}
        />
        <Pressable
          accessibilityLabel="Send message"
          accessibilityRole="button"
          disabled={!canSend}
          onPress={() => onSend(value)}
          style={[st.sendBtn, !canSend && st.sendBtnDisabled]}
        >
          <Feather color={THEME.primaryForeground} name="arrow-up" size={18} />
        </Pressable>
      </View>
    </View>
  );
}
