import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { Screen } from "@/components/ui/Screen";
import { supabase } from "@/lib/supabase";
import type { Client } from "@/types/database";

export default function ClientsListScreen() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsLoading(true);
      supabase
        .from("clients")
        .select("*")
        .order("name")
        .then(({ data }) => {
          if (isActive) {
            setClients(data ?? []);
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
        <Text className="text-2xl font-bold text-ink">Clients</Text>
        <Pressable
          onPress={() => router.push("/clients/new")}
          className="h-10 w-10 items-center justify-center rounded-full bg-brand-600"
        >
          <Plus color="#fff" size={20} />
        </Pressable>
      </View>

      <FlatList
        data={clients}
        keyExtractor={(item) => item.id}
        contentContainerClassName="gap-3 pb-10"
        refreshing={isLoading}
        ListEmptyComponent={
          !isLoading ? (
            <Text className="mt-10 text-center text-sm text-subtle">
              No clients yet. Tap + to add one.
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/(tabs)/clients/${item.id}`)}
            className="gap-1 rounded-2xl border border-border bg-surface p-4"
          >
            <Text className="text-base font-semibold text-ink">{item.name}</Text>
            {item.phone && <Text className="text-sm text-subtle">{item.phone}</Text>}
            {item.email && <Text className="text-sm text-subtle">{item.email}</Text>}
          </Pressable>
        )}
      />
    </Screen>
  );
}
