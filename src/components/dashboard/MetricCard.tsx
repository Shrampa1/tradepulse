import { Text, View } from "react-native";
import { Card } from "@/components/ui/Card";

export function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "brand" | "success" | "warning";
}) {
  const accentClass =
    accent === "success" ? "text-success" : accent === "warning" ? "text-warning" : "text-brand-600";

  return (
    <Card className="flex-1 gap-1">
      <Text className="text-xs font-medium uppercase tracking-wide text-subtle">{label}</Text>
      <Text className={`text-2xl font-bold ${accentClass}`}>{value}</Text>
    </Card>
  );
}
