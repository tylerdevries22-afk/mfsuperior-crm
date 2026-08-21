import Feather from "@expo/vector-icons/Feather";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { RADIUS, SPACE, TYPO, useTheme } from "@/theme";

import { FreightBackHeader } from "./FreightChrome";
import type { FreightFormSpec } from "./types";

export function FreightFormScreen({ spec }: { readonly spec: FreightFormSpec }) {
  const theme = useTheme();
  const [values, setValues] = useState<Readonly<Record<string, string>>>({});
  const [submitted, setSubmitted] = useState(false);
  const canSubmit = spec.fields.every((field) => (values[field.key] ?? "").trim().length > 0);
  return <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: theme.background }]}><FreightBackHeader title={spec.title} /><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.safe}><ScrollView contentContainerStyle={styles.content} keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"} keyboardShouldPersistTaps="handled"><View style={styles.hero}><Text style={[styles.eyebrow, { color: theme.primaryLight }]}>{spec.eyebrow}</Text><Text style={[styles.title, { color: theme.text }]}>{spec.title}</Text><Text style={[styles.description, { color: theme.textSecondary }]}>{spec.description}</Text></View>{submitted ? <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={[styles.success, { backgroundColor: theme.successMuted, borderColor: theme.tint.success.medium }]}><Feather color={theme.success} name="check-circle" size={20} /><Text style={[styles.successText, { color: theme.text }]}>{spec.successMessage}</Text></View> : null}<View style={styles.fields}>{spec.fields.map((field) => <View key={field.key} style={styles.field}><Text style={[styles.label, { color: theme.textSecondary }]}>{field.label}</Text><TextInput accessibilityLabel={field.label} multiline={field.multiline} onChangeText={(value) => { setSubmitted(false); setValues((current) => ({ ...current, [field.key]: value })); }} placeholder={field.placeholder} placeholderTextColor={theme.textMuted} style={[styles.input, field.multiline && styles.multiline, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, color: theme.text }]} value={values[field.key] ?? ""} /></View>)}</View><Pressable accessibilityRole="button" accessibilityState={{ disabled: !canSubmit }} disabled={!canSubmit} onPress={() => setSubmitted(true)} style={({ pressed }) => [styles.submit, { backgroundColor: theme.primary }, !canSubmit && styles.disabled, pressed && styles.pressed]}><Text style={[styles.submitText, { color: theme.primaryForeground }]}>{spec.submitLabel}</Text><Feather color={theme.primaryForeground} name="arrow-right" size={18} /></Pressable></ScrollView></KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({
  content: { gap: SPACE.lg, paddingBottom: SPACE.xxl, paddingHorizontal: 20, paddingTop: SPACE.lg },
  description: { ...TYPO.body },
  disabled: { opacity: 0.45 },
  eyebrow: { ...TYPO.eyebrow },
  field: { gap: 7 },
  fields: { gap: SPACE.md },
  hero: { gap: SPACE.sm },
  input: { ...TYPO.body, borderRadius: RADIUS.md, borderWidth: 1, minHeight: 54, paddingHorizontal: 15, paddingVertical: 13 },
  label: { ...TYPO.captionStrong, marginLeft: 3 },
  multiline: { minHeight: 116, textAlignVertical: "top" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  safe: { flex: 1 },
  submit: { alignItems: "center", borderRadius: RADIUS.pill, flexDirection: "row", gap: 9, justifyContent: "center", minHeight: 54 },
  submitText: { ...TYPO.button },
  success: { alignItems: "flex-start", borderRadius: RADIUS.md, borderWidth: 1, flexDirection: "row", gap: 10, padding: 14 },
  successText: { ...TYPO.caption, flex: 1 },
  title: { ...TYPO.largeTitle, fontSize: 34, lineHeight: 39 },
});
