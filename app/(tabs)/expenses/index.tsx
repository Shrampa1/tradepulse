import { useCallback, useMemo, useState } from "react";
import { Pressable, SectionList, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { Screen } from "@/components/ui/Screen";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Expense } from "@/types/database";

const KIND_LABEL: Record<string, string> = {
  material: "Material",
  mileage: "Mileage",
  labor: "Labor",
  other: "Other",
};

export default function ExpensesListScreen() {
  const router = useRouter();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsLoading(true);
      supabase
        .from("expenses")
        .select("*")
        .order("occurred_at", { ascending: false })
        .then(({ data }) => {
          if (isActive) {
            setExpenses(data ?? []);
            setIsLoading(false);
          }
        });
      return () => {
        isActive = false;
      };
    }, [])
  );

  const sections = useMemo(() => groupByMonth(expenses), [expenses]);
  const total = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);

  return (
    <Screen scroll={false} className="pt-4">
      <View className="mb-3 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-bold text-ink">Expenses</Text>
          <Text className="text-sm text-subtle">{formatCurrency(total)} total</Text>
        </View>
        <Pressable
          onPress={() => router.push("/expenses/new")}
          className="h-10 w-10 items-center justify-center rounded-full bg-brand-600"
        >
          <Plus color="#fff" size={20} />
        </Pressable>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerClassName="gap-2 pb-10"
        refreshing={isLoading}
        ListEmptyComponent={
          !isLoading ? (
            <Text className="mt-10 text-center text-sm text-subtle">
              No expenses yet. Tap + to log one.
            </Text>
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <View className="flex-row items-center justify-between bg-muted py-2">
            <Text className="text-sm font-semibold text-ink">{section.title}</Text>
            <Text className="text-sm text-subtle">{formatCurrency(section.total)}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View className="gap-1 rounded-2xl border border-border bg-surface p-4">
            <View className="flex-row items-center justify-between">
              <Text className="flex-1 text-base font-semibold text-ink">{item.description}</Text>
              <Text className="text-base font-semibold text-ink">{formatCurrency(Number(item.amount))}</Text>
            </View>
            <Text className="text-sm text-subtle">
              {KIND_LABEL[item.kind] ?? item.kind} · {formatDate(item.occurred_at)}
            </Text>
          </View>
        )}
      />
    </Screen>
  );
}

function groupByMonth(expenses: Expense[]) {
  const groups = new Map<string, { title: string; total: number; data: Expense[] }>();

  for (const expense of expenses) {
    const date = new Date(expense.occurred_at);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const title = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (!groups.has(key)) groups.set(key, { title, total: 0, data: [] });
    const group = groups.get(key)!;
    group.total += Number(expense.amount);
    group.data.push(expense);
  }

  return Array.from(groups.values());
}
