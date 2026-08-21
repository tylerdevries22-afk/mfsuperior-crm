import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import type { PressableProps, StyleProp, ViewStyle } from "react-native";

import { ICON, makeStyles, RADIUS, SIZE, useTheme } from "../../theme";
import { PressableSurface, type HapticStrength } from "./PressableSurface";

export type IconButtonProps = Omit<PressableProps, "children" | "style"> & {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  size?: "sm" | "md";
  variant?: "ghost" | "surface" | "brand";
  haptic?: HapticStrength;
  style?: StyleProp<ViewStyle>;
};

const useStyles = makeStyles((theme) => ({
  button: { alignItems: "center", justifyContent: "center", borderRadius: RADIUS.md },
  sm: { width: SIZE.hit, height: SIZE.hit },
  md: { width: SIZE.button.md, height: SIZE.button.md },
  ghost: { backgroundColor: "transparent" },
  surface: { backgroundColor: theme.surfaceElevated, borderWidth: 1, borderColor: theme.border },
  brand: { backgroundColor: theme.primary },
}));

/** Icon-only action with an explicit accessibility label and 44-point target. */
export function IconButton({
  icon,
  label,
  size = "sm",
  variant = "ghost",
  haptic = "selection",
  style,
  ...props
}: IconButtonProps) {
  const styles = useStyles();
  const theme = useTheme();
  const color = variant === "brand" ? theme.primaryForeground : theme.text;
  return (
    <PressableSurface
      {...props}
      accessibilityLabel={label}
      haptic={haptic}
      style={[styles.button, styles[size], styles[variant], style]}
    >
      <Ionicons name={icon} size={size === "sm" ? ICON.md : ICON.lg} color={color} />
    </PressableSurface>
  );
}
