import { Pressable, Text } from "react-native";
import type { LucideIcon } from "lucide-react-native";

export function QuickActionButton({
  label,
  Icon,
  onPress,
}: {
  label: string;
  Icon: LucideIcon;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center gap-2 rounded-2xl border border-border bg-surface py-5 active:bg-muted"
    >
      <Icon color="#2563eb" size={24} />
      <Text className="text-sm font-semibold text-ink">{label}</Text>
    </Pressable>
  );
}
