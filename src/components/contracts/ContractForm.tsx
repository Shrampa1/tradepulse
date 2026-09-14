import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LineItemsEditor } from "@/components/estimates/LineItemsEditor";
import { supabase } from "@/lib/supabase";
import type { DraftLineItem, RecurringContract, RecurringContractFrequency } from "@/types/database";

const FREQUENCIES: { value: RecurringContractFrequency; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

type Props = {
  clientId: string;
  onSaved: (contract: RecurringContract) => void;
};

export function ContractForm({ clientId, onSaved }: Props) {
  const [title, setTitle] = useState("");
  const [frequency, setFrequency] = useState<RecurringContractFrequency>("monthly");
  const [items, setItems] = useState<DraftLineItem[]>([]);
  const [taxRate, setTaxRate] = useState(0);
  const [depositAmount, setDepositAmount] = useState("0");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("tax_rate")
      .single()
      .then(({ data }) => {
        if (data) setTaxRate(Number(data.tax_rate));
      });
  }, []);

  async function handleSave() {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (items.length === 0) {
      setError("Add at least one line item.");
      return;
    }
    const nextRunAt = new Date(startDate);
    if (Number.isNaN(nextRunAt.getTime())) {
      setError("Enter a valid start date (YYYY-MM-DD).");
      return;
    }

    setIsSaving(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError("You must be signed in.");
      setIsSaving(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("recurring_contracts")
      .insert({
        user_id: userData.user.id,
        client_id: clientId,
        title: title.trim(),
        frequency,
        line_items_template: items.map(({ description, quantity, unit_price }) => ({
          id: randomUUID(),
          description,
          quantity,
          unit_price,
        })),
        tax_rate: taxRate,
        deposit_amount: toNumber(depositAmount),
        next_run_at: nextRunAt.toISOString(),
      })
      .select()
      .single();

    setIsSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    onSaved(data as RecurringContract);
  }

  return (
    <View className="gap-3">
      <Input label="Title" value={title} onChangeText={setTitle} placeholder="Monthly lawn care" />

      <Card className="gap-3">
        <Text className="text-sm font-semibold text-ink">Frequency</Text>
        <View className="flex-row gap-2">
          {FREQUENCIES.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => setFrequency(option.value)}
              className={`rounded-full border px-3.5 py-2 ${
                frequency === option.value ? "border-brand-600 bg-brand-50" : "border-border bg-surface"
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  frequency === option.value ? "text-brand-600" : "text-subtle"
                }`}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Input
        label="First invoice date"
        value={startDate}
        onChangeText={setStartDate}
        placeholder="YYYY-MM-DD"
      />
      <Input
        label="Deposit amount"
        value={depositAmount}
        onChangeText={setDepositAmount}
        keyboardType="decimal-pad"
      />

      <Card className="gap-3">
        <Text className="text-sm font-semibold text-ink">Line items (each invoice)</Text>
        <LineItemsEditor items={items} taxRate={taxRate} onChange={setItems} />
      </Card>

      {error && <Text className="text-sm text-danger">{error}</Text>}
      <Button label="Save contract" onPress={handleSave} loading={isSaving} />
    </View>
  );
}

function toNumber(text: string) {
  const value = parseFloat(text.replace(/[^0-9.]/g, ""));
  return Number.isFinite(value) ? value : 0;
}
