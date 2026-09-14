import { Stack } from "expo-router";

export default function ClientsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]/index" options={{ title: "Client" }} />
      <Stack.Screen name="[id]/contracts/new" options={{ title: "New Contract" }} />
    </Stack>
  );
}
