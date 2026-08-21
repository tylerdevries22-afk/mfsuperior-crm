import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { WorkspaceGrid, type WorkspaceAction } from "@/components/operations";
import { Button, Card, Header, PressableSurface, Screen, SectionHeader, TextField } from "@/components/ui";
import { localAssistantReply } from "@/lib/tab-workspaces";
import { useOperations } from "@/store";
import { ICON, RADIUS, SPACE, TYPO, useTheme } from "@/theme";

interface ChatMessage {
  readonly id: number;
  readonly author: "assistant" | "user";
  readonly body: string;
}

const SUGGESTIONS = ["What is my next stop?", "Explain the HOS clock", "Is partner EDI ready?"] as const;

function ChatBubble({ message }: { readonly message: ChatMessage }) {
  const theme = useTheme();
  const fromUser = message.author === "user";
  return (
    <View
      accessibilityLabel={`${fromUser ? "You" : "Operations assistant"}: ${message.body}`}
      style={[
        styles.bubble,
        fromUser ? styles.userBubble : styles.assistantBubble,
        {
          backgroundColor: fromUser ? theme.primary : theme.surface,
          borderColor: fromUser ? theme.primary : theme.border,
        },
      ]}
    >
      <Text style={[styles.bubbleText, { color: fromUser ? theme.primaryForeground : theme.text }]}>{message.body}</Text>
    </View>
  );
}

function SuggestionRow({ onSelect }: { readonly onSelect: (suggestion: string) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.suggestions}>
      {SUGGESTIONS.map((suggestion) => (
        <PressableSurface
          accessibilityLabel={`Ask: ${suggestion}`}
          haptic="selection"
          key={suggestion}
          onPress={() => onSelect(suggestion)}
          style={[styles.suggestion, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
        >
          <Text style={[styles.suggestionText, { color: theme.primaryLight }]}>{suggestion}</Text>
        </PressableSurface>
      ))}
    </View>
  );
}

function useAssistantConversation(activeLoadId?: string) {
  const nextId = useRef(2);
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<readonly ChatMessage[]>([{
    id: 1,
    author: "assistant",
    body: "I can help with freight records, HOS, exceptions, equipment, and EDI workflows. Critical actions still require your confirmation.",
  }]);

  function sendPrompt(value = prompt): void {
    const cleanPrompt = value.trim();
    if (!cleanPrompt) return;
    const userId = nextId.current++;
    const assistantId = nextId.current++;
    setMessages((current) => [...current,
      { id: userId, author: "user", body: cleanPrompt },
      { id: assistantId, author: "assistant", body: localAssistantReply(cleanPrompt, activeLoadId) },
    ]);
    setPrompt("");
  }
  return { messages, prompt, sendPrompt, setPrompt };
}

function AssistantIntro() {
  const theme = useTheme();
  return (
    <Card variant="outlined">
      <View style={styles.assistantMark}>
        <View style={[styles.orb, { backgroundColor: theme.primaryMuted }]}>
          <Ionicons color={theme.primaryLight} name="sparkles-outline" size={ICON.xl} />
        </View>
        <View style={styles.grow}>
          <Text style={[styles.title, { color: theme.text }]}>Operations copilot</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Fast, repeatable guidance for freight operations.</Text>
        </View>
      </View>
    </Card>
  );
}

function Conversation({ messages }: { readonly messages: readonly ChatMessage[] }) {
  return (
    <>
      <SectionHeader title="Conversation" />
      <View accessibilityLabel="Assistant conversation" accessible style={styles.conversation}>
        {messages.map((message) => <ChatBubble key={message.id} message={message} />)}
      </View>
    </>
  );
}

function Composer({ prompt, onPromptChange, onSend }: {
  readonly prompt: string;
  readonly onPromptChange: (value: string) => void;
  readonly onSend: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.composer}>
      <TextField accessibilityLabel="Ask the operations assistant" containerStyle={styles.grow} maxLength={240} onChangeText={onPromptChange} onSubmitEditing={onSend} placeholder="Ask about a load or workflow" returnKeyType="send" value={prompt} />
      <Button accessibilityLabel="Send question" disabled={!prompt.trim()} icon={<Ionicons color={theme.primaryForeground} name="arrow-up" size={ICON.md} />} onPress={onSend} title="Send" />
    </View>
  );
}

export default function AssistantScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { activeShipment, effectiveRole } = useOperations();
  const chat = useAssistantConversation(activeShipment?.loadNumber);

  const actions: readonly WorkspaceAction[] = [
    { key: "triage", label: "Exception triage", detail: "Delay, damage, temperature", icon: "warning-outline", tone: "warning", onPress: () => router.push("/exception-diagnostic") },
    { key: "hos", label: "HOS guide", detail: "Duty-clock explanation", icon: "timer-outline", tone: "success", onPress: () => router.push("/hours-of-service") },
    ...(effectiveRole === "admin" ? [{ key: "edi", label: "EDI audit", detail: "204 · 990 · 214 · 210 · 997", icon: "git-network-outline" as const, tone: "info" as const, onPress: () => router.push("/edi-audit") }] : []),
  ];

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Header subtitle="Freight guidance and guided triage" title="Assistant" />
      <Screen keyboardAware safeEdges={["left", "right", "bottom"]} scroll contentContainerStyle={styles.content}>
        <AssistantIntro />
        <SuggestionRow onSelect={chat.sendPrompt} />
        <Conversation messages={chat.messages} />
        <Composer onPromptChange={chat.setPrompt} onSend={() => chat.sendPrompt()} prompt={chat.prompt} />
        <SectionHeader title="Guided workflows" />
        <WorkspaceGrid actions={actions} />
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  assistantBubble: { alignSelf: "flex-start" },
  assistantMark: { alignItems: "center", flexDirection: "row", gap: SPACE.md },
  bubble: { borderRadius: RADIUS.md, borderWidth: 1, maxWidth: "88%", paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm },
  bubbleText: { ...TYPO.body },
  composer: { alignItems: "flex-end", flexDirection: "row", gap: SPACE.sm },
  content: { gap: SPACE.md, paddingBottom: SPACE.xxl },
  conversation: { gap: SPACE.sm },
  fill: { flex: 1 },
  grow: { flex: 1, minWidth: 0 },
  orb: { alignItems: "center", borderRadius: RADIUS.lg, height: 56, justifyContent: "center", width: 56 },
  suggestion: { borderRadius: RADIUS.pill, borderWidth: 1, minHeight: 44, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm },
  suggestionText: { ...TYPO.captionStrong },
  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  subtitle: { ...TYPO.caption, marginTop: SPACE.xxs },
  title: { ...TYPO.cardTitle },
  userBubble: { alignSelf: "flex-end" },
});
