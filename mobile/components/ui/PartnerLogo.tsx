import { useState } from "react";
import { Image, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { findPartner, partnerMonogram, type MobilePartner } from "../../domain/partners";
import { makeStyles, RADIUS } from "../../theme";

export type PartnerLogoSize = "sm" | "md" | "lg";

/** Height in points; width follows the 15:4 lockup ratio. */
const SIZE_PT: Record<PartnerLogoSize, number> = { sm: 16, md: 22, lg: 30 };
const LOGO_RATIO = 240 / 64;

export type PartnerLogoProps = {
  /** Partner slug or a known alias. Unknown values render the monogram. */
  slug: string;
  size?: PartnerLogoSize | number;
  /** Overrides the accessible label. Defaults to the partner name. */
  label?: string;
  /** Pre-resolved partner, when the caller already looked it up. */
  partner?: MobilePartner | null;
  style?: StyleProp<ViewStyle>;
};

const useStyles = makeStyles(() => ({
  // White plate: these lockups are mostly dark wordmarks and the app is
  // dark-first, so they would otherwise disappear into the surface.
  plate: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: RADIUS.sm,
    justifyContent: "center",
    overflow: "hidden",
  },
  image: { height: "100%", width: "100%" },
  fallback: { alignItems: "center", borderRadius: RADIUS.sm, justifyContent: "center" },
  monogram: { color: "#ffffff", fontWeight: "700" },
}));

/**
 * A partner's logo, or a brand-coloured monogram when the slug is unknown or
 * the asset fails to load — a missing logo never leaves a hole in a row.
 */
export function PartnerLogo({ slug, size = "md", label, partner, style }: PartnerLogoProps) {
  const styles = useStyles();
  const [failed, setFailed] = useState(false);
  const resolved = partner ?? findPartner(slug);
  const height = typeof size === "number" ? size : SIZE_PT[size];
  const name = label ?? resolved?.name ?? slug;

  if (!resolved || failed) {
    return (
      <View
        accessibilityLabel={name}
        accessibilityRole="image"
        accessible
        style={[
          styles.fallback,
          { backgroundColor: resolved?.accent ?? "#64748B", height, width: height },
          style,
        ]}
      >
        <Text style={[styles.monogram, { fontSize: Math.max(8, Math.round(height * 0.42)) }]}>
          {partnerMonogram(name)}
        </Text>
      </View>
    );
  }

  return (
    <View
      accessibilityLabel={name}
      accessibilityRole="image"
      accessible
      style={[styles.plate, { height, width: Math.round(height * LOGO_RATIO) }, style]}
    >
      <Image
        onError={() => setFailed(true)}
        resizeMode="contain"
        source={resolved.logo}
        style={styles.image}
      />
    </View>
  );
}
