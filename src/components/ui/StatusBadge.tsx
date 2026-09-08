import { Text, View } from "react-native";
import type { EstimateStatus } from "@/types/database";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/format";

export function StatusBadge({ status }: { status: EstimateStatus }) {
  const colors = STATUS_COLOR[status] ?? STATUS_COLOR.draft;
  return (
    <View className={`self-start rounded-full px-2.5 py-1 ${colors.bg}`}>
      <Text className={`text-xs font-semibold ${colors.text}`}>{STATUS_LABEL[status] ?? status}</Text>
    </View>
  );
}
