import type { ReactNode } from "react";
import { ActivityIndicator, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ICON, makeStyles, RADIUS, SPACE, TYPO, useTheme } from "../../theme";
import { Button } from "./Button";

type BaseStateProps = {
  title: string;
  message?: string;
  /** Compatibility alias for message. */
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export type EmptyStateProps = BaseStateProps & { actionLabel?: string; onAction?: () => void };
export type ErrorStateProps = Omit<BaseStateProps, "action"> & { retryLabel?: string; onRetry?: () => void };
export type LoadingStateProps = { label?: string; style?: StyleProp<ViewStyle> };

const useStyles = makeStyles((theme) => ({
  state: {
    flex: 1,
    minHeight: 280,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.xxl,
  },
  icon: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.pill,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACE.lg,
  },
  title: { ...TYPO.heading, color: theme.text, textAlign: "center" },
  message: { ...TYPO.body, color: theme.textSecondary, textAlign: "center", maxWidth: 320, marginTop: SPACE.xs },
  action: { marginTop: SPACE.lg, minWidth: 160 },
  loading: { flex: 1, minHeight: 220, alignItems: "center", justifyContent: "center", gap: SPACE.md },
  loadingLabel: { ...TYPO.body, color: theme.textSecondary },
}));

function StateView({ title, message, description, icon, action, style }: BaseStateProps) {
  const styles = useStyles();
  return (
    <View style={[styles.state, style]}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      {message ?? description ? <Text style={styles.message}>{message ?? description}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

export function EmptyState({
  title,
  message,
  description,
  icon,
  action,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  const theme = useTheme();
  const resolvedIcon = icon ?? <Ionicons name="file-tray-outline" size={36} color={theme.textMuted} />;
  const resolvedAction = action ?? (actionLabel && onAction ? <Button title={actionLabel} variant="secondary" onPress={onAction} /> : undefined);
  return <StateView action={resolvedAction} description={description} icon={resolvedIcon} message={message} style={style} title={title} />;
}

export function ErrorState({
  title,
  message,
  description,
  icon,
  retryLabel = "Try again",
  onRetry,
  style,
}: ErrorStateProps) {
  const theme = useTheme();
  const resolvedIcon = icon ?? <Ionicons name="alert-circle-outline" size={ICON.xl + 8} color={theme.danger} />;
  const action = onRetry ? <Button title={retryLabel} variant="secondary" onPress={onRetry} /> : undefined;
  return (
    <View accessibilityRole="alert">
      <StateView action={action} description={description} icon={resolvedIcon} message={message} style={style} title={title} />
    </View>
  );
}

export function LoadingState({ label = "Loading", style }: LoadingStateProps) {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <View accessible accessibilityLabel={label} accessibilityRole="progressbar" style={[styles.loading, style]}>
      <ActivityIndicator color={theme.primaryLight} size="small" />
      <Text style={styles.loadingLabel}>{label}</Text>
    </View>
  );
}
