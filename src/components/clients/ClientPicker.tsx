import { useEffect, useState } from "react";
import { FlatList, Modal, Pressable, Text, View } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/Input";
import type { Client } from "@/types/database";

type Props = {
  value: Client | null;
  onChange: (client: Client) => void;
};

export function ClientPicker({ value, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    supabase
      .from("clients")
      .select("*")
      .order("name")
      .then(({ data }) => setClients(data ?? []));
  }, [isOpen]);

  const filtered = clients.filter((client) =>
    client.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View>
      <Pressable
        onPress={() => setIsOpen(true)}
        className="flex-row items-center justify-between rounded-xl border border-border bg-surface px-3.5 py-3"
      >
        <Text className={value ? "text-base text-ink" : "text-base text-subtle"}>
          {value ? value.name : "Select a client"}
        </Text>
        <ChevronDown size={18} color="#64748b" />
      </Pressable>

      <Modal visible={isOpen} animationType="slide" onRequestClose={() => setIsOpen(false)}>
        <View className="flex-1 gap-3 bg-muted p-4 pt-14">
          <Text className="text-lg font-bold text-ink">Select client</Text>
          <Input placeholder="Search clients" value={search} onChangeText={setSearch} />
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerClassName="gap-2"
            ListEmptyComponent={
              <Text className="py-6 text-center text-sm text-subtle">No clients match.</Text>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onChange(item);
                  setIsOpen(false);
                }}
                className="rounded-xl border border-border bg-surface p-3"
              >
                <Text className="text-base font-semibold text-ink">{item.name}</Text>
                {item.phone && <Text className="text-sm text-subtle">{item.phone}</Text>}
              </Pressable>
            )}
          />
          <Pressable onPress={() => setIsOpen(false)} className="items-center py-3">
            <Text className="text-sm font-semibold text-brand-600">Cancel</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}
