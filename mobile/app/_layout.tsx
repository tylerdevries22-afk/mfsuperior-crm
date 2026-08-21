import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { OperationsProvider, useOperations } from "@/store";
import { ThemeProvider, useTheme } from "@/theme";

function BootstrapFallback({ label }: { readonly label: string }) {
  const theme = useTheme();
  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="progressbar"
      style={[styles.bootstrap, { backgroundColor: theme.background }]}
      testID="app-bootstrap-fallback"
    >
      <ActivityIndicator color={theme.primaryLight} size="large" />
      <Text style={[styles.title, { color: theme.text }]}>MF Superior Products</Text>
      <Text style={[styles.status, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

function RootNavigator() {
  const theme = useTheme();
  const { currentAccount, isHydrated } = useOperations();

  if (!isHydrated) {
    return <BootstrapFallback label="Restoring your session" />;
  }

  return (
    <>
      <StatusBar style={theme.mode === "light" ? "dark" : "light"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background },
          animation: "fade_from_bottom",
          animationDuration: 200,
        }}
      >
        <Stack.Protected guard={currentAccount === null}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={currentAccount !== null}>
          <ProtectedScreens />
        </Stack.Protected>
      </Stack>
    </>
  );
}

function ProtectedScreens() {
  return <><Stack.Screen name="(tabs)" /><Stack.Screen name="mfa" /><Stack.Screen name="load/[id]" /><Stack.Screen name="route-planner/[id]" /><Stack.Screen name="proof-of-delivery/[id]" options={{ animation: "slide_from_bottom" }} /><Stack.Screen name="exception/new" options={{ animation: "slide_from_bottom" }} /><Stack.Screen name="exception-diagnosis" /><Stack.Screen name="exception-diagnostic" /><Stack.Screen name="exception-session/[id]" /><Stack.Screen name="exception-signals" /><Stack.Screen name="exception-codes/index" /><Stack.Screen name="exception-codes/[id]" /><Stack.Screen name="edi-codes/[id]" /><Stack.Screen name="diagnostics/[id]" /><Stack.Screen name="documents/[id]" /><Stack.Screen name="operations/index" /><Stack.Screen name="customers/index" /><Stack.Screen name="customers/[id]" /><Stack.Screen name="team/index" /><Stack.Screen name="team/[id]" /><Stack.Screen name="quotes/index" /><Stack.Screen name="quotes/[id]" /><Stack.Screen name="invoices/index" /><Stack.Screen name="invoices/[id]" /><Stack.Screen name="loads/index" /><Stack.Screen name="loads/new" /><Stack.Screen name="leads/index" /><Stack.Screen name="leads/new" /><Stack.Screen name="leads/[id]" /><Stack.Screen name="payments/index" /><Stack.Screen name="payments/[id]" /><Stack.Screen name="rate-book/index" /><Stack.Screen name="rate-book/[id]" /><Stack.Screen name="service-programs/index" /><Stack.Screen name="service-programs/[id]" /><Stack.Screen name="tags/index" /><Stack.Screen name="integration-events/index" /><Stack.Screen name="integration-events/[id]" /><Stack.Screen name="capacity-marketplace/index" /><Stack.Screen name="capacity-marketplace/cart" /><Stack.Screen name="capacity-marketplace/orders" /><Stack.Screen name="capacity-marketplace/capacity-detail" /><Stack.Screen name="capacity-marketplace/booking-detail" /><Stack.Screen name="capacity-marketplace/release-request" /><Stack.Screen name="capacity-marketplace/search" /><Stack.Screen name="equipment-marketplace/index" /><Stack.Screen name="equipment-marketplace/cart" /><Stack.Screen name="equipment-marketplace/orders" /><Stack.Screen name="equipment-marketplace/equipment-detail" /><Stack.Screen name="equipment-marketplace/order-detail" /><Stack.Screen name="equipment-marketplace/return-request" /><Stack.Screen name="equipment-marketplace/search" /><Stack.Screen name="capacity/index" /><Stack.Screen name="capacity/[id]" /><Stack.Screen name="capacity/analytics" /><Stack.Screen name="capacity/planner" options={{ animation: "slide_from_bottom" }} /><Stack.Screen name="capacity/document-scan" /><Stack.Screen name="capacity/search" /><Stack.Screen name="capacity/orders" /><Stack.Screen name="capacity/scan" /><Stack.Screen name="capacity/transfer" /><Stack.Screen name="capacity/equipment" /><Stack.Screen name="equipment/index" /><Stack.Screen name="equipment/[id]" /><Stack.Screen name="suppliers/index" /><Stack.Screen name="suppliers/[id]" /><Stack.Screen name="messages" /><Stack.Screen name="edi-audit" /><Stack.Screen name="hours-of-service" /><Stack.Screen name="location-tracker" /><Stack.Screen name="history" /><Stack.Screen name="knowledge" /><Stack.Screen name="analytics" /><Stack.Screen name="configure" /><Stack.Screen name="profile-details" /><Stack.Screen name="freight-document-viewer" /><Stack.Screen name="driver-toolbox" /><Stack.Screen name="workflow-builder" options={{ animation: "slide_from_bottom" }} /></>;
}

export default function RootLayout() {
  // Match the pinned reference app: native font loading is non-blocking so a
  // stalled loader can never prevent navigation from mounting.
  useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <OperationsProvider>
          <RootNavigator />
        </OperationsProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  bootstrap: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  status: {
    fontSize: 15,
    marginTop: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: 20,
  },
});
