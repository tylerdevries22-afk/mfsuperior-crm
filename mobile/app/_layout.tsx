import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { OperationsProvider, useOperations } from "@/store";
import { ThemeProvider, TYPO, useTheme } from "@/theme";

function BootstrapFallback({ label }: { readonly label: string }) {
  const theme = useTheme();
  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="progressbar"
      style={[styles.bootstrap, { backgroundColor: theme.background }]}
    >
      <View style={[styles.mark, { backgroundColor: theme.primary }]}>
        <Text style={[styles.markText, { color: theme.primaryForeground }]}>MF</Text>
      </View>
      <Text style={[styles.title, { color: theme.text }]}>MF Superior</Text>
      <ActivityIndicator color={theme.primaryLight} size="large" />
      <Text style={[styles.status, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

function RootNavigator({ fontsLoaded }: { readonly fontsLoaded: boolean }) {
  const theme = useTheme();
  const { currentAccount, isHydrated } = useOperations();

  if (!fontsLoaded || !isHydrated) {
    return <BootstrapFallback label={!fontsLoaded ? "Loading the interface" : "Restoring demo operations"} />;
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
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="load/[id]" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="route-planner/[id]" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="proof-of-delivery/[id]" options={{ animation: "slide_from_bottom" }} />
          <Stack.Screen name="exception/new" options={{ animation: "slide_from_bottom" }} />
          <Stack.Screen name="feature/[slug]" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="messages" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="edi-audit" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="hours-of-service" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="location-tracker" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="history" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="knowledge" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="analytics" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="configure" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="workflow-builder" options={{ animation: "slide_from_bottom" }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <OperationsProvider>
          <RootNavigator fontsLoaded={fontsLoaded} />
        </OperationsProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  bootstrap: {
    alignItems: "center",
    flex: 1,
    gap: 16,
    justifyContent: "center",
    padding: 24,
  },
  mark: {
    alignItems: "center",
    borderRadius: 18,
    height: 64,
    justifyContent: "center",
    width: 64,
  },
  markText: {
    ...TYPO.heading,
  },
  status: {
    ...TYPO.caption,
  },
  title: {
    ...TYPO.screenTitle,
    fontSize: 28,
    lineHeight: 34,
  },
});
