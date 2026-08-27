import { Image, StyleSheet, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from "react-native";

import type { PayoutRail } from "@/domain/types";
import { RADIUS, useTheme } from "@/theme";

const LOGO_SOURCES: Record<PayoutRail, ImageSourcePropType> = {
  apple_cash: require("@/assets/payouts/apple-cash.png") as ImageSourcePropType,
  cash_app: require("@/assets/payouts/cash-app.png") as ImageSourcePropType,
  venmo: require("@/assets/payouts/venmo.png") as ImageSourcePropType,
  zelle: require("@/assets/payouts/zelle.png") as ImageSourcePropType,
};

const LOGO_LABELS: Record<PayoutRail, string> = {
  apple_cash: "Apple Cash",
  cash_app: "Cash App",
  venmo: "Venmo",
  zelle: "Zelle",
};

const MOSAIC_RAILS: readonly PayoutRail[] = ["venmo", "cash_app", "zelle", "apple_cash"];

export type PayoutRailLogoProps = {
  rail: PayoutRail;
  size?: "sm" | "md";
  style?: StyleProp<ViewStyle>;
  accessible?: boolean;
};

export function PayoutRailLogo({
  accessible = true,
  rail,
  size = "md",
  style,
}: PayoutRailLogoProps) {
  const theme = useTheme();
  const dimension = size === "sm" ? 36 : 44;
  const imageDimension = size === "sm" ? 28 : 36;

  return (
    <View
      accessibilityLabel={accessible ? `${LOGO_LABELS[rail]} logo` : undefined}
      accessibilityRole={accessible ? "image" : undefined}
      accessible={accessible}
      style={[
        styles.plate,
        {
          backgroundColor: theme.surfaceBright,
          borderColor: theme.border,
          height: dimension,
          width: dimension,
        },
        style,
      ]}
    >
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={LOGO_SOURCES[rail]}
        style={{ height: imageDimension, width: imageDimension }}
      />
    </View>
  );
}

export type PayoutRailMosaicProps = {
  size?: "sm" | "md";
  style?: StyleProp<ViewStyle>;
};

export function PayoutRailMosaic({ size = "sm", style }: PayoutRailMosaicProps) {
  const tileSize = size === "sm" ? 36 : 44;
  const step = size === "sm" ? 15 : 19;

  return (
    <View
      accessibilityLabel="Payout methods: Venmo, Cash App, Zelle, and Apple Cash"
      accessibilityRole="image"
      accessible
      style={[styles.mosaic, { height: tileSize, width: tileSize + step * 3 }, style]}
    >
      {MOSAIC_RAILS.map((rail, index) => (
        <PayoutRailLogo
          accessible={false}
          key={rail}
          rail={rail}
          size={size}
          style={[styles.mosaicTile, { left: index * step, zIndex: MOSAIC_RAILS.length - index }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  mosaic: { position: "relative" },
  mosaicTile: { position: "absolute", top: 0 },
  plate: {
    alignItems: "center",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    justifyContent: "center",
    overflow: "hidden",
  },
});
