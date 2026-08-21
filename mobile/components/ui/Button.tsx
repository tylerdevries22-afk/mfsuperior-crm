import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Text,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { makeStyles, RADIUS, SIZE, SPACE, TYPO, useTheme } from "../../theme";
import { PressableSurface, type HapticStrength } from "./PressableSurface";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = Omit<PressableProps, "children" | "style"> & {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  loading?: boolean;
  fullWidth?: boolean;
  haptic?: HapticStrength;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

const useStyles = makeStyles((theme) => ({
  base: {
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: SPACE.sm,
    paddingVertical: SPACE.sm,
  },
  fullWidth: { alignSelf: "stretch" },
  disabled: { opacity: 0.48 },
  primary: { backgroundColor: theme.primary, borderWidth: 1, borderColor: theme.primary },
  secondary: {
    backgroundColor: theme.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.border,
  },
  outline: { backgroundColor: "transparent", borderWidth: 1, borderColor: theme.primaryLight },
  ghost: { backgroundColor: "transparent", borderWidth: 1, borderColor: "transparent" },
  danger: { backgroundColor: theme.dangerMuted, borderWidth: 1, borderColor: theme.dangerMuted },
  primaryText: { ...TYPO.button, color: theme.primaryForeground },
  secondaryText: { ...TYPO.button, color: theme.text },
  outlineText: { ...TYPO.button, color: theme.primaryLight },
  ghostText: { ...TYPO.button, color: theme.primaryLight },
  dangerText: { ...TYPO.button, color: theme.danger },
}));

const HORIZONTAL_PADDING: Record<ButtonSize, number> = { sm: SPACE.md, md: SPACE.lg, lg: SPACE.xl };

/** Accessible, non-gradient button that preserves the Appliance control geometry. */
export function Button({
  title,
  variant = "primary",
  size = "md",
  icon,
  iconPosition = "left",
  loading = false,
  fullWidth = false,
  haptic = "medium",
  disabled = false,
  style,
  textStyle,
  accessibilityLabel,
  accessibilityState,
  ...props
}: ButtonProps) {
  const styles = useStyles();
  const theme = useTheme();
  const isDisabled = disabled || loading;

  return (
    <PressableSurface
      {...props}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ ...accessibilityState, busy: loading, disabled: isDisabled }}
      disabled={isDisabled}
      haptic={haptic}
      style={[
        styles.base,
        styles[variant],
        { minHeight: SIZE.button[size], paddingHorizontal: HORIZONTAL_PADDING[size] },
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? theme.primaryForeground : theme.text} />
      ) : (
        <>
          {iconPosition === "left" ? icon : null}
          <Text style={[styles[`${variant}Text`], textStyle]}>{title}</Text>
          {iconPosition === "right" ? icon : null}
        </>
      )}
    </PressableSurface>
  );
}

/** Compatibility alias for reference-app screens. */
export const AnimatedButton = Button;
