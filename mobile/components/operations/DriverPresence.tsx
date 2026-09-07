import { StyleSheet, View } from "react-native";
import type { Driver } from "@/domain/types";
import { useTheme } from "@/theme";
import { DriverAvatar } from "./DriverAvatar";

export function DriverPresence({ driver, size = 32 }: { readonly driver: Driver; readonly size?: number }) {
  const theme = useTheme();
  const color = driver.status === "suspended" ? theme.danger : driver.status === "off_duty" ? theme.textMuted : theme.success;
  return <View accessible accessibilityRole="image" accessibilityLabel={`${driver.firstName} ${driver.lastName}, ${driver.status.replaceAll("_", " ")}`} style={styles.avatar}>
    <DriverAvatar driver={driver} ring={false} size={size} />
    <View style={[styles.dot, { backgroundColor: color, borderColor: theme.surface }]} />
  </View>;
}
const styles = StyleSheet.create({
  avatar: { alignSelf: "flex-start", flexShrink: 0 },
  dot: { position: "absolute", right: -1, bottom: -1, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
});
