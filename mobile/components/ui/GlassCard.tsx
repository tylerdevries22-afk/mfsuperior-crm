import type { ReactNode } from "react";
import { BlurView } from "expo-blur";
import { View, type StyleProp, type ViewStyle } from "react-native";

import {
  MATERIAL_INTENSITY,
  makeStyles,
  materialTint,
  materialWash,
  RADIUS,
  refractionBorder,
  shadowCard,
  specularHighlight,
  SPACE,
  useTheme,
} from "../../theme";

export type GlassCardVariant = "default" | "elevated" | "outlined";

export type GlassCardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: GlassCardVariant;
  noPadding?: boolean;
  testID?: string;
};

/** Each variant maps to the system material of equivalent weight. */
const VARIANT_LEVEL = {
  default: "regular",
  elevated: "thick",
  outlined: "ultraThin",
} as const;

const useStyles = makeStyles((theme) => ({
  base: {
    borderRadius: RADIUS.xl,
    // The blur must be clipped to the corner curve, or it bleeds past the card.
    overflow: "hidden",
    ...refractionBorder(theme),
    ...shadowCard(theme),
  },
  fill: { padding: SPACE.md },
  noPadding: { padding: 0 },
  /**
   * A one-pixel inset highlight along the top edge. Real glass refracts light
   * at its boundary; without this the blur reads as flat translucency.
   */
  specular: { ...specularHighlight(theme), borderRadius: RADIUS.xl },
}));

/**
 * Translucent material surface.
 *
 * Renders an actual `expo-blur` material rather than an opaque fill, so content
 * behind it shows through the way a system material does. `materialWash` is
 * layered under the blur because Android and web `backdrop-filter` produce a
 * thinner result than iOS at the same intensity.
 */
export function GlassCard({
  children,
  style,
  variant = "default",
  noPadding = false,
  testID,
}: GlassCardProps) {
  const styles = useStyles();
  const theme = useTheme();
  const level = VARIANT_LEVEL[variant];

  return (
    <View style={[styles.base, style]} testID={testID}>
      <BlurView
        intensity={MATERIAL_INTENSITY[level]}
        style={[styles.fill, noPadding && styles.noPadding, { backgroundColor: materialWash(theme, level) }]}
        tint={materialTint(theme.mode, level)}
      >
        {children}
      </BlurView>
      <View pointerEvents="none" style={[styles.specular, { position: "absolute", inset: 0 }]} />
    </View>
  );
}
