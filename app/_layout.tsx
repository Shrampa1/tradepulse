import "@/global.css";
import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { installCrashReporter } from "@/lib/crashReporter";

// Registered at module scope (not inside a component) so it's in place
// before anything below gets a chance to render -- see crashReporter.ts's
// own header comment for why this is here at all.
installCrashReporter();

function ThemeRestorer() {
  const { setColorScheme } = useColorScheme();

  useEffect(() => {
    AsyncStorage.getItem("theme-preference").then((stored) => {
      if (stored === "light" || stored === "dark" || stored === "system") setColorScheme(stored);
    });
  }, []);

  return null;
}

function RootNavigator() {
  const { session, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === "(auth)";

    if (!session && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [session, isLoading, segments]);

  return (
    <Stack screenOptions={{ headerShadowVisible: false }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="estimates/new"
        options={{ presentation: "modal", title: "New Estimate" }}
      />
      <Stack.Screen
        name="clients/new"
        options={{ presentation: "modal", title: "New Client" }}
      />
      <Stack.Screen
        name="clients/import"
        options={{ presentation: "modal", title: "Import Clients" }}
      />
      <Stack.Screen
        name="expenses/new"
        options={{ presentation: "modal", title: "New Expense" }}
      />
      <Stack.Screen name="expenses/[id]" options={{ title: "Expense" }} />
      <Stack.Screen
        name="appointments/new"
        options={{ presentation: "modal", title: "New Appointment" }}
      />
      <Stack.Screen name="appointments/[id]" options={{ title: "Appointment" }} />
      <Stack.Screen
        name="settings/index"
        options={{ presentation: "modal", title: "Settings" }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ThemeRestorer />
        <StatusBar style="dark" />
        <RootNavigator />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
