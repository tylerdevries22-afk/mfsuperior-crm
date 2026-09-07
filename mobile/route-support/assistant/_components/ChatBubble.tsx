import { Text, View } from "react-native";

import { useTheme } from "@/theme";

export interface ChatMessage {
  readonly id: string;
  readonly author: "assistant" | "user";
  readonly body: string;
}

export function ChatBubble({ message }: { readonly message: ChatMessage }) {
  const theme = useTheme();
  const fromUser = message.author === "user";
  return (
    <View
      accessibilityLabel={`${fromUser ? "You" : "Operations assistant"}: ${message.body}`}
      style={{
        alignSelf: fromUser ? "flex-end" : "flex-start",
        maxWidth: "86%",
        marginBottom: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 18,
        borderWidth: 1,
        backgroundColor: fromUser ? theme.primary : theme.surface,
        borderColor: fromUser ? theme.primary : theme.border,
      }}
    >
      <Text
        style={{
          color: fromUser ? theme.primaryForeground : theme.text,
          fontSize: 15,
          lineHeight: 21,
        }}
      >
        {message.body}
      </Text>
    </View>
  );
}
