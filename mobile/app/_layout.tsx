import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { protectedScreens } from "@/navigation/protected-screens";

import { OperationsProvider, useOperations } from "@/store";
import { ThemeProvider, useTheme } from "@/theme";

// Keep a home route below deep links, including browser reloads.
export const unstable_settings = { initialRouteName: "(tabs)" };

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
  const { accessState, currentAccount, isHydrated } = useOperations();

  if (!isHydrated) {
    return <BootstrapFallback label="Restoring your session" />;
  }

  // A `customer/pending` membership is refused by every operational endpoint,
  // so it never reaches the tab navigator.
  const isPending = currentAccount !== null && accessState === "pending_customer_approval";

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
        <Stack.Protected guard={isPending}>
          <Stack.Screen name="pending-approval" />
        </Stack.Protected>
        <Stack.Protected guard={currentAccount !== null && !isPending}>
          {protectedScreens.map((screen) => <Stack.Screen key={screen.name} {...screen} />)}
        </Stack.Protected>
      </Stack>
    </>
  );
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
