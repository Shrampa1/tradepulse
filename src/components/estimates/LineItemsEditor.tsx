import { Text, TextInput, View } from "react-native";
import { Trash2, Plus } from "lucide-react-native";
import { Pressable } from "react-native";
import { randomUUID } from "expo-crypto";
import type { DraftLineItem } from "@/types/database";
import { estimateTotals, lineItemTotal } from "@/lib/calculations";
import { formatCurrency } from "@/lib/format";

type Props = {
  items: DraftLineItem[];
  taxRate: number;
  onChange: (items: DraftLineItem[]) => void;
};

export function LineItemsEditor({ items, taxRate, onChange }: Props) {
  const totals = estimateTotals(items, taxRate);

  function updateItem(id: string, patch: Partial<DraftLineItem>) {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removeItem(id: string) {
    onChange(items.filter((item) => item.id !== id));
  }

  function addItem() {
    onChange([
      ...items,
      { id: randomUUID(), description: "", quantity: 1, unit_price: 0 },
    ]);
  }

  return (
    <View className="gap-3">
      {items.length === 0 && (
        <Text className="py-2 text-center text-sm text-subtle">
          No line items yet. Add one below, or use voice/photo capture above.
        </Text>
      )}

      {items.map((item) => (
        <View key={item.id} className="gap-2 rounded-xl border border-border bg-surface p-3">
          <View className="flex-row items-start justify-between gap-2">
            <TextInput
              value={item.description}
              onChangeText={(text) => updateItem(item.id, { description: text })}
              placeholder="Description (e.g. Trim front hedges)"
              placeholderTextColor="#94a3b8"
              multiline
              className="flex-1 text-base text-ink"
            />
            <Pressable onPress={() => removeItem(item.id)} hitSlop={8}>
              <Trash2 size={18} color="#dc2626" />
            </Pressable>
          </View>

          <View className="flex-row items-center gap-3">
            <Field
              label="Qty"
              value={String(item.quantity)}
              onChangeText={(text) => updateItem(item.id, { quantity: toNumber(text) })}
            />
            <Field
              label="Unit price"
              value={String(item.unit_price)}
              onChangeText={(text) => updateItem(item.id, { unit_price: toNumber(text) })}
              prefix="$"
            />
            <View className="ml-auto items-end">
              <Text className="text-xs text-subtle">Total</Text>
              <Text className="text-base font-semibold text-ink">
                {formatCurrency(lineItemTotal(item))}
              </Text>
            </View>
          </View>
        </View>
      ))}

      <Pressable
        onPress={addItem}
        className="flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3"
      >
        <Plus size={16} color="#2563eb" />
        <Text className="text-sm font-semibold text-brand-600">Add line item</Text>
      </Pressable>

      <View className="gap-1.5 rounded-xl bg-muted p-3">
        <SummaryRow label="Subtotal" value={totals.subtotal} />
        <SummaryRow label={`Tax (${(taxRate * 100).toFixed(2)}%)`} value={totals.tax} />
        <View className="mt-1 flex-row justify-between border-t border-border pt-1.5">
          <Text className="text-base font-bold text-ink">Total</Text>
          <Text className="text-base font-bold text-ink">{formatCurrency(totals.total)}</Text>
        </View>
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  prefix,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  prefix?: string;
}) {
  return (
    <View className="gap-1">
      <Text className="text-xs text-subtle">{label}</Text>
      <View className="flex-row items-center rounded-lg border border-border px-2 py-1.5">
        {prefix && <Text className="text-subtle">{prefix}</Text>}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          className="w-16 text-base text-ink"
        />
      </View>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-sm text-subtle">{label}</Text>
      <Text className="text-sm text-ink">{formatCurrency(value)}</Text>
    </View>
  );
}

function toNumber(text: string) {
  const cleaned = text.replace(/[^0-9.]/g, "");
  const value = parseFloat(cleaned);
  return Number.isFinite(value) ? value : 0;
}
