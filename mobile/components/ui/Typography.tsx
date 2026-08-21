import { Text, type StyleProp, type TextProps, type TextStyle } from "react-native";

import { makeStyles, SPACE, TYPO } from "../../theme";

export type TextVariant = keyof typeof TYPO;

export type AppTextProps = TextProps & {
  variant?: TextVariant;
  color?: "default" | "secondary" | "muted" | "brand" | "inverse";
  style?: StyleProp<TextStyle>;
};

const useStyles = makeStyles((theme) => ({
  default: { color: theme.text },
  secondary: { color: theme.textSecondary },
  muted: { color: theme.textMuted },
  brand: { color: theme.primaryLight },
  inverse: { color: theme.textInverse },
  sectionSpacing: { marginTop: SPACE.md },
}));

/** Theme-aware text with one of the shared role-based typography styles. */
export function AppText({ variant = "body", color = "default", style, ...props }: AppTextProps) {
  const styles = useStyles();
  return <Text {...props} style={[TYPO[variant], styles[color], style]} />;
}

type RoleProps = Omit<AppTextProps, "variant">;

export function Eyebrow(props: RoleProps) {
  return <AppText accessibilityRole="header" variant="eyebrow" color="brand" {...props} />;
}

export function Title(props: RoleProps) {
  return <AppText accessibilityRole="header" variant="screenTitle" {...props} />;
}

export function SectionTitle({ style, ...props }: RoleProps) {
  const styles = useStyles();
  return (
    <AppText
      accessibilityRole="header"
      variant="section"
      {...props}
      style={[styles.sectionSpacing, style]}
    />
  );
}

export function Heading(props: RoleProps) {
  return <AppText accessibilityRole="header" variant="heading" {...props} />;
}

export function Body({ muted = false, ...props }: RoleProps & { muted?: boolean }) {
  return <AppText variant="body" color={muted ? "secondary" : "default"} {...props} />;
}
