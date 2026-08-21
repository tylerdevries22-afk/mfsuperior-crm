import type { ReactNode } from "react";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";

import { makeStyles, RADIUS, shadowCard, SPACE, TYPO } from "../../theme";
import { AnimatedPressable } from "./AnimatedPressable";

export type WorkspaceCardProps = {
  title?: string;
  action?: string;
  onAction?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const useStyles = makeStyles((theme) => ({
  card: {
    borderRadius: RADIUS.lg,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    padding: SPACE.lg,
    gap: SPACE.sm,
    ...shadowCard(theme),
  },
  header: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  title: { ...TYPO.cardTitle, color: theme.text, flexShrink: 1, flex: 1 },
  action: { ...TYPO.captionStrong, color: theme.primaryLight },
}));

/**
 * Role-based standard card ported from Appliance Diagnostic Systems commit
 * 480991b7eb0036e4e85c37d3784b2de2ca97d10d.
 */
export function WorkspaceCard({ title, action, onAction, children, style, testID }: WorkspaceCardProps) {
  const styles = useStyles();
  return (
    <View style={[styles.card, style]} testID={testID}>
      {title ? (
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          {action && onAction ? (
            <AnimatedPressable
              accessibilityLabel={action}
              ensureMinTarget={false}
              haptic="selection"
              hitSlop={8}
              onPress={onAction}
            >
              <Text style={styles.action}>{action}</Text>
            </AnimatedPressable>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}
