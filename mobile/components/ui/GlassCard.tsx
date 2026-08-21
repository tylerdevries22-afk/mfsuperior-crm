import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { CARD_SHADOW, makeStyles, RADIUS_LEGACY, SPACING } from "../../theme";

export type GlassCardVariant = "default" | "elevated" | "outlined";

export type GlassCardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: GlassCardVariant;
  noPadding?: boolean;
  testID?: string;
};

const useStyles = makeStyles((theme) => ({
  base: {
    backgroundColor: theme.surface,
    borderRadius: RADIUS_LEGACY.xl,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: theme.border,
    ...CARD_SHADOW,
  },
  elevated: { backgroundColor: theme.surfaceElevated, borderColor: theme.borderLight },
  outlined: { backgroundColor: "transparent", borderColor: theme.border },
  noPadding: { padding: 0 },
}));

/**
 * Static 18pt-radius glass surface ported from Appliance Diagnostic Systems
 * commit 480991b7eb0036e4e85c37d3784b2de2ca97d10d.
 */
export function GlassCard({
  children,
  style,
  variant = "default",
  noPadding = false,
  testID,
}: GlassCardProps) {
  const styles = useStyles();
  return (
    <View
      style={[
        styles.base,
        variant === "elevated" && styles.elevated,
        variant === "outlined" && styles.outlined,
        noPadding && styles.noPadding,
        style,
      ]}
      testID={testID}
    >
      {children}
    </View>
  );
}
