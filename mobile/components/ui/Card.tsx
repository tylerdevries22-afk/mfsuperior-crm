import type { ReactNode } from "react";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";

import { makeStyles, RADIUS, shadowCard, SPACE, TYPO } from "../../theme";
import { PressableSurface } from "./PressableSurface";

export type CardVariant = "default" | "elevated" | "outlined" | "tinted";
export type CardPadding = "none" | "compact" | "default";

export type CardProps = {
  children: ReactNode;
  title?: string;
  action?: string;
  onAction?: () => void;
  onPress?: () => void;
  accessibilityLabel?: string;
  variant?: CardVariant;
  padding?: CardPadding;
  style?: StyleProp<ViewStyle>;
};

const useStyles = makeStyles((theme) => ({
  card: {
    borderRadius: RADIUS.lg,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    gap: SPACE.sm,
    ...shadowCard(theme),
  },
  elevated: { backgroundColor: theme.surfaceElevated, borderColor: theme.borderLight },
  outlined: { backgroundColor: "transparent", shadowOpacity: 0, elevation: 0 },
  tinted: { backgroundColor: theme.tint.primary.muted, borderColor: theme.tint.primary.medium },
  noPadding: { padding: 0 },
  compactPadding: { padding: SPACE.md },
  defaultPadding: { padding: SPACE.lg },
  header: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  title: { ...TYPO.cardTitle, color: theme.text, flex: 1, flexShrink: 1 },
  actionPressable: { alignItems: "center", justifyContent: "center", paddingHorizontal: SPACE.xs },
  action: { ...TYPO.captionStrong, color: theme.primaryLight },
}));

function CardContent({ title, action, onAction, children }: Pick<CardProps, "title" | "action" | "onAction" | "children">) {
  const styles = useStyles();
  return (
    <>
      {title ? (
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          {action && onAction ? (
            <PressableSurface
              accessibilityLabel={action}
              haptic="selection"
              onPress={onAction}
              style={styles.actionPressable}
            >
              <Text style={styles.action}>{action}</Text>
            </PressableSurface>
          ) : null}
        </View>
      ) : null}
      {children}
    </>
  );
}

/** Standard bordered content surface, optionally pressable and titled. */
export function Card({
  children,
  title,
  action,
  onAction,
  onPress,
  accessibilityLabel,
  variant = "default",
  padding = "default",
  style,
}: CardProps) {
  const styles = useStyles();
  const cardStyle = [
    styles.card,
    variant !== "default" && styles[variant],
    padding === "none" ? styles.noPadding : padding === "compact" ? styles.compactPadding : styles.defaultPadding,
    style,
  ];
  const content = <CardContent title={title} action={action} onAction={onAction}>{children}</CardContent>;

  if (!onPress) return <View style={cardStyle}>{content}</View>;
  return (
    <PressableSurface
      accessibilityLabel={accessibilityLabel ?? title}
      haptic="selection"
      onPress={onPress}
      style={cardStyle}
    >
      {content}
    </PressableSurface>
  );
}

export const WorkspaceCard = Card;
export const GlassCard = Card;
export const AnimatedCard = Card;
