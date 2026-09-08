import { ScrollView, View, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function Screen({ scroll = true, className, children }: ViewProps & { scroll?: boolean }) {
  const Container = scroll ? ScrollView : View;
  return (
    <SafeAreaView className="flex-1 bg-muted" edges={["top", "left", "right"]}>
      <Container
        className={`flex-1 px-4 ${className ?? ""}`}
        contentContainerClassName={scroll ? "gap-4 pb-10 pt-4" : undefined}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </Container>
    </SafeAreaView>
  );
}
