import { useEffect, useState } from "react";
import { FlatList, Modal, Pressable, Text, View } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Estimate } from "@/types/database";

export type EstimateOption = Estimate & { clients: { name: string } | null };

type Props = {
  value: EstimateOption | null;
  onChange: (estimate: EstimateOption) => void;
};

export function EstimatePicker({ value, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [estimates, setEstimates] = useState<EstimateOption[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    supabase
      .from("estimates")
      .select("*, clients ( name )")
      .order("created_at", { ascending: false })
      .then(({ data }) => setEstimates((data as any) ?? []));
  }, [isOpen]);

  const filtered = estimates.filter((estimate) =>
    (estimate.clients?.name ?? "no client").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View>
      <Pressable
        onPress={() => setIsOpen(true)}
        className="flex-row items-center justify-between rounded-xl border border-border bg-surface px-3.5 py-3"
      >
        <Text className={value ? "text-base text-ink" : "text-base text-subtle"}>
          {value
            ? `${value.clients?.name ?? "No client"} — ${formatCurrency(value.total_amount)}`
            : "Link an estimate (optional)"}
        </Text>
        <ChevronDown size={18} color="#64748b" />
      </Pressable>

      <Modal visible={isOpen} animationType="slide" onRequestClose={() => setIsOpen(false)}>
        <View className="flex-1 gap-3 bg-muted p-4 pt-14">
          <Text className="text-lg font-bold text-ink">Select an estimate</Text>
          <Input placeholder="Search by client name" value={search} onChangeText={setSearch} />
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerClassName="gap-2"
            ListEmptyComponent={
              <Text className="py-6 text-center text-sm text-subtle">No estimates match.</Text>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onChange(item);
                  setIsOpen(false);
                }}
                className="gap-1 rounded-xl border border-border bg-surface p-3"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-base font-semibold text-ink">
                    {item.clients?.name ?? "No client"}
                  </Text>
                  <Text className="text-sm font-semibold text-ink">{formatCurrency(item.total_amount)}</Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <StatusBadge status={item.status} />
                  <Text className="text-xs text-subtle">{formatDate(item.created_at)}</Text>
                </View>
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
