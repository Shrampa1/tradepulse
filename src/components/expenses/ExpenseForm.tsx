import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ClientPicker } from "@/components/clients/ClientPicker";
import { ReceiptCapture } from "@/components/expenses/ReceiptCapture";
import { VoiceExpenseCapture } from "@/components/expenses/VoiceExpenseCapture";
import { supabase } from "@/lib/supabase";
import type { Client, Expense, ExpenseKind } from "@/types/database";

const KINDS: { value: ExpenseKind; label: string }[] = [
  { value: "material", label: "Material" },
  { value: "mileage", label: "Mileage" },
  { value: "labor", label: "Labor" },
  { value: "other", label: "Other" },
];

type Props = {
  expense?: Expense;
  estimateId?: string;
  initialClient?: Client | null;
  onSaved: (expense: Expense) => void;
};

export function ExpenseForm({ expense, estimateId, initialClient, onSaved }: Props) {
  const isEditing = Boolean(expense);
  const [kind, setKind] = useState<ExpenseKind>(expense?.kind ?? "material");
  const [category, setCategory] = useState(expense?.category ?? "");
  const [description, setDescription] = useState(expense?.description ?? "");
  const [amount, setAmount] = useState(String(expense?.amount ?? 0));
  const [miles, setMiles] = useState(String(expense?.miles ?? 0));
  const [mileageRate, setMileageRate] = useState(0.67);
  const [occurredAt, setOccurredAt] = useState(
    expense ? expense.occurred_at.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [client, setClient] = useState<Client | null>(initialClient ?? null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("mileage_rate")
      .single()
      .then(({ data }) => {
        if (data) setMileageRate(Number(data.mileage_rate));
      });
  }, []);

  function applyParsedExpense(receipt: { vendor: string; description: string; amount: number; occurred_at: string | null }) {
    setKind("material");
    setDescription(receipt.vendor ? `${receipt.vendor} — ${receipt.description}` : receipt.description);
    setAmount(String(receipt.amount));
    if (receipt.occurred_at) setOccurredAt(receipt.occurred_at.slice(0, 10));
  }

  const computedMileageAmount = toNumber(miles) * mileageRate;

  async function handleSave() {
    if (!description.trim()) {
      setError("Description is required.");
      return;
    }
    setIsSaving(true);
    setError(null);

    const finalAmount = kind === "mileage" ? computedMileageAmount : toNumber(amount);
    const payload = {
      client_id: client?.id ?? null,
      kind,
      category: category.trim() || null,
      description: description.trim(),
      amount: finalAmount,
      miles: kind === "mileage" ? toNumber(miles) : null,
      occurred_at: new Date(occurredAt).toISOString(),
    };

    if (isEditing && expense) {
      const { data, error: updateError } = await supabase
        .from("expenses")
        .update(payload)
        .eq("id", expense.id)
        .select()
        .single();
      setIsSaving(false);
      if (updateError) {
        setError(updateError.message);
        return;
      }
      onSaved(data as Expense);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError("You must be signed in.");
      setIsSaving(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("expenses")
      .insert({ ...payload, user_id: userData.user.id, estimate_id: estimateId ?? null })
      .select()
      .single();

    setIsSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    onSaved(data as Expense);
  }

  return (
    <View className="gap-3">
      {kind === "material" && <ReceiptCapture onParsed={applyParsedExpense} />}
      <VoiceExpenseCapture onParsed={applyParsedExpense} />

      <Card className="gap-3">
        <Text className="text-sm font-semibold text-ink">Type</Text>
        <View className="flex-row flex-wrap gap-2">
          {KINDS.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => setKind(option.value)}
              className={`rounded-full border px-3.5 py-2 ${
                kind === option.value ? "border-brand-600 bg-brand-50" : "border-border bg-surface"
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  kind === option.value ? "text-brand-600" : "text-subtle"
                }`}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Input
        label="Custom label (optional)"
        value={category}
        onChangeText={setCategory}
        placeholder="e.g. Permits, Subcontractor, Fuel"
      />

      <Input
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="Lumber and fasteners"
      />

      {kind === "mileage" ? (
        <>
          <Input label="Miles" value={miles} onChangeText={setMiles} keyboardType="decimal-pad" />
          <Text className="text-sm text-subtle">
            {miles || 0} mi × ${mileageRate.toFixed(3)}/mi = ${computedMileageAmount.toFixed(2)}
          </Text>
        </>
      ) : (
        <Input label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      )}

      <Input label="Date" value={occurredAt} onChangeText={setOccurredAt} placeholder="YYYY-MM-DD" />

      {!estimateId && (
        <View className="gap-1.5">
          <Text className="text-sm font-medium text-ink">Client (optional)</Text>
          <ClientPicker value={client} onChange={setClient} />
        </View>
      )}

      {error && <Text className="text-sm text-danger">{error}</Text>}
      <Button label={isEditing ? "Save changes" : "Save expense"} onPress={handleSave} loading={isSaving} />
    </View>
  );
}

function toNumber(text: string) {
  const value = parseFloat(text.replace(/[^0-9.]/g, ""));
  return Number.isFinite(value) ? value : 0;
}
