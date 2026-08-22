import { Image, StyleSheet, Text, View, type ImageSourcePropType } from "react-native";

import type { Driver } from "@/domain/types";
import { FONTS } from "@/theme";

import { FALLBACK_COLOR, getInitials, hashColor } from "@/route-support/schedule/utils";

/**
 * Ported from the Appliance Diagnostic Systems `TechAvatar` at
 * 480991b7eb0036e4e85c37d3784b2de2ca97d10d, which renders a real portrait
 * inside a colour-coded ring and falls back to initials only when no image
 * exists. The resolution order here adds the bundled demo portraits so the
 * demo workspace shows real faces rather than initials.
 */

/**
 * Demo drivers ship with real portraits so the schedule looks like production.
 * Production drivers arrive from the API with `avatarUrl` instead.
 */
const BUNDLED_AVATARS: Record<string, ImageSourcePropType> = {
  // Metro resolves bundled React Native assets through static require calls.
   
  "driver-brenna": require("@/assets/avatars/driver-brenna.webp"),
   
  "driver-samuel": require("@/assets/avatars/driver-samuel.webp"),
};

export function resolveDriverAvatar(driver: Driver): ImageSourcePropType | null {
  if (driver.avatarUrl) return { uri: driver.avatarUrl };
  return BUNDLED_AVATARS[driver.id] ?? null;
}

export function driverColor(driver: Pick<Driver, "id">): string {
  return hashColor(driver.id) || FALLBACK_COLOR;
}

export function DriverAvatar({
  driver,
  size,
  past,
  ring = true,
}: {
  readonly driver: Driver;
  readonly size: number;
  readonly past?: boolean;
  readonly ring?: boolean;
}) {
  const color = past ? "#4B5563" : driverColor(driver);
  const source = resolveDriverAvatar(driver);
  const borderWidth = ring ? 2 : 0;

  if (source) {
    return (
      <View
        style={[
          styles.ring,
          {
            width: size + borderWidth * 2,
            height: size + borderWidth * 2,
            borderRadius: (size + borderWidth * 2) / 2,
            borderColor: color,
            borderWidth,
          },
        ]}
      >
        <Image
          accessibilityIgnoresInvertColors
          source={source}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            opacity: past ? 0.55 : 1,
          }}
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
      ]}
    >
      <Text style={[styles.initials, { fontSize: size * 0.38, lineHeight: size }]}>
        {getInitials(driver.firstName, driver.lastName)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: "center", justifyContent: "center" },
  initials: { color: "#FFF", fontFamily: FONTS.semibold },
  ring: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
});
