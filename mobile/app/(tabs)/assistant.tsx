import { Feather } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { localAssistantReply } from "@/lib/tab-workspaces";
import {
  ASSISTANT_QUICK_ACTIONS,
  AssistantWelcome,
  type AssistantQuickAction,
} from "@/route-support/assistant/_components/AssistantWelcome";
import { AssistantInputBar } from "@/route-support/assistant/_components/AssistantInputBar";
import { st } from "@/route-support/assistant/styles";
import { useOperations } from "@/store";
import { THEME, useTheme } from "@/theme";

/**
 * Ported from the Appliance Diagnostic Systems assistant at
 * 480991b7eb0036e4e85c37d3784b2de2ca97d10d: a header carrying a live
 * "Thinking" indicator and a new-chat action, a keyboard-avoiding body that
 * shows the welcome screen until the first message, a chat list, and the
 * composer with its suggested-reply rail.
 */

interface ChatMessage {
  readonly id: string;
  readonly author: "assistant" | "user";
  readonly body: string;
}

const TAB_BAR_HEIGHT = 88;

function ChatBubble({ message }: { readonly message: ChatMessage }) {
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

export default function AssistantScreen() {
  const insets = useSafeAreaInsets();
  const { activeShipment } = useOperations();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const [messages, setMessages] = useState<readonly ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [activeQuickAction, setActiveQuickAction] = useState<string | null>(null);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardWillShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardWillHide", () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;
      const question: ChatMessage = {
        id: `u-${Date.now()}`,
        author: "user",
        body: trimmed,
      };
      setMessages((prev) => [...prev, question]);
      setInputText("");
      setActiveQuickAction(null);
      setStreaming(true);

      // The reference streams from its model; the freight assistant answers
      // from local freight records so it still works offline.
      const reply = localAssistantReply(trimmed, activeShipment?.loadNumber);
      const timer = setTimeout(() => {
        setMessages((prev) => [...prev, { id: `a-${Date.now()}`, author: "assistant", body: reply }]);
        setStreaming(false);
      }, 380);
      return () => clearTimeout(timer);
    },
    [activeShipment?.loadNumber, streaming],
  );

  const startNewChat = useCallback(() => {
    setMessages([]);
    setInputText("");
    setActiveQuickAction(null);
  }, []);

  const handleQuickAction = useCallback(
    (action: AssistantQuickAction) => {
      setActiveQuickAction(action.key);
      send(action.prompt);
    },
    [send],
  );

  useEffect(() => {
    if (messages.length > 0) {
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages.length]);

  const suggestions = messages.length > 0 && !streaming
    ? ASSISTANT_QUICK_ACTIONS.slice(0, 3).map((action) => action.prompt)
    : [];

  return (
    <View style={st.container}>
      <View style={[st.header, { paddingTop: insets.top + 8 }]}>
        <View style={st.headerCenter}>
          <Text style={st.headerTitle}>Assistant</Text>
          {streaming ? (
            <View style={st.headerLive}>
              <View style={st.liveDot} />
              <Text style={st.liveText}>Thinking</Text>
            </View>
          ) : null}
        </View>
        <Pressable
          accessibilityLabel="New chat"
          accessibilityRole="button"
          hitSlop={12}
          onPress={startNewChat}
          style={st.newChatBtn}
        >
          <Feather color={THEME.text} name="edit" size={20} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
        style={st.body}
      >
        {messages.length === 0 ? (
          // `welcomeWrap` is flex:1, so it must be a direct child of the
          // flexing body — a wrapper without flex collapses it to zero height.
          <AssistantWelcome
            activeQuickAction={activeQuickAction}
            onQuickAction={handleQuickAction}
          />
        ) : (
          <FlatList
            contentContainerStyle={st.chatList}
            data={messages}
            keyExtractor={(item) => item.id}
            ref={listRef}
            renderItem={({ item }) => <ChatBubble message={item} />}
            showsVerticalScrollIndicator={false}
          />
        )}

        {streaming ? (
          <View style={st.toolStatusRow}>
            <ActivityIndicator color={THEME.primary} size="small" />
            <Text style={st.liveText}>Checking freight records…</Text>
          </View>
        ) : null}

        <AssistantInputBar
          insets={insets}
          keyboardVisible={keyboardVisible}
          onChangeText={setInputText}
          onSend={send}
          onSuggestion={send}
          streaming={streaming}
          suggestedReplies={suggestions}
          tabBarHeight={TAB_BAR_HEIGHT}
          value={inputText}
        />
      </KeyboardAvoidingView>
    </View>
  );
}
