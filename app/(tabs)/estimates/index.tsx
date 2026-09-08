import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { Screen } from "@/components/ui/Screen";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Estimate } from "@/types/database";

type Row = Estimate & { clients: { name: string } | null };

export default function EstimatesListScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsLoading(true);
      supabase
        .from("estimates")
        .select("*, clients ( name )")
        .order("created_at", { ascending: false })
        .then(({ data }) => {
          if (isActive) {
            setRows((data ?? []) as Row[]);
            setIsLoading(false);
          }
        });
      return () => {
        isActive = false;
      };
    }, [])
  );

  return (
    <Screen scroll={false} className="pt-4">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-ink">Estimates</Text>
        <Pressable
          onPress={() => router.push({ pathname: "/estimates/new", params: { mode: "estimate" } })}
          className="h-10 w-10 items-center justify-center rounded-full bg-brand-600"
        >
          <Plus color="#fff" size={20} />
        </Pressable>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerClassName="gap-3 pb-10"
        refreshing={isLoading}
        ListEmptyComponent={
          !isLoading ? (
            <Text className="mt-10 text-center text-sm text-subtle">
              No estimates yet. Tap + to create your first one.
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/(tabs)/estimates/${item.id}`)}
            className="gap-2 rounded-2xl border border-border bg-surface p-4"
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-semibold text-ink">
                {item.clients?.name ?? "No client"}
              </Text>
              <StatusBadge status={item.status} />
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-subtle">{formatDate(item.created_at)}</Text>
              <Text className="text-base font-bold text-ink">{formatCurrency(item.total_amount)}</Text>
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}
