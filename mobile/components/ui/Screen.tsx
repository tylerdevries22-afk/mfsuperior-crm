import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { makeStyles, SPACE, useTheme } from "../../theme";

export type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  keyboardAware?: boolean;
  safeEdges?: readonly Edge[];
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollViewProps?: Omit<ScrollViewProps, "contentContainerStyle" | "style">;
  testID?: string;
};

const useStyles = makeStyles((theme) => ({
  safeArea: { flex: 1, backgroundColor: theme.background },
  keyboard: { flex: 1 },
  content: { flex: 1 },
  padded: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, gap: SPACE.md },
  scrollContent: { flexGrow: 1 },
}));

/** Safe-area screen shell with optional scrolling and keyboard avoidance. */
export function Screen({
  children,
  scroll = true,
  padded = true,
  keyboardAware = false,
  safeEdges = ["top", "left", "right", "bottom"],
  style,
  contentContainerStyle,
  scrollViewProps,
  testID,
}: ScreenProps) {
  const styles = useStyles();
  const theme = useTheme();
  const content = scroll ? (
    <ScrollView
      {...scrollViewProps}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={styles.content}
      contentContainerStyle={[
        styles.scrollContent,
        padded && styles.padded,
        contentContainerStyle,
      ]}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, padded && styles.padded, contentContainerStyle]}>{children}</View>
  );

  return (
    <SafeAreaView edges={safeEdges} style={[styles.safeArea, style]} testID={testID}>
      <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />
      {keyboardAware ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboard}
        >
          {content}
        </KeyboardAvoidingView>
      ) : content}
    </SafeAreaView>
  );
}
