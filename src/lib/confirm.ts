import { Alert, Platform } from "react-native";

// Alert.alert's web shim is unreliable (buttons/callbacks don't consistently
// fire in react-native-web), so this uses window.confirm there and the real
// native Alert everywhere else — one call site works on both.
export function confirmAsync(message: string): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(window.confirm(message));
  }
  return new Promise((resolve) => {
    Alert.alert("Are you sure?", message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "Delete", style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}
