import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { randomUUID } from "expo-crypto";
import { Screen } from "@/components/ui/Screen";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ClientPicker } from "@/components/clients/ClientPicker";
import { LineItemsEditor } from "@/components/estimates/LineItemsEditor";
import { VoiceCapture } from "@/components/estimates/VoiceCapture";
import { PhotoCapture } from "@/components/estimates/PhotoCapture";
import { supabase } from "@/lib/supabase";
import type { Client, DraftLineItem, EstimateDiscountType } from "@/types/database";

const DISCOUNT_TYPES: { value: EstimateDiscountType; label: string }[] = [
  { value: "fixed", label: "$ Fixed" },
  { value: "percent", label: "% Percent" },
];

export default function NewEstimateScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isQuickInvoice = mode === "invoice";
  const router = useRouter();

  const [client, setClient] = useState<Client | null>(null);
  const [jobAddress, setJobAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftLineItem[]>([]);
  const [taxRate, setTaxRate] = useState(0);
  const [discountType, setDiscountType] = useState<EstimateDiscountType>("fixed");
  const [discountValue, setDiscountValue] = useState("0");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoiceDefaults, setInvoiceDefaults] = useState({
    invoiceNumberPrefix: "",
    nextInvoiceNumber: 1,
    paymentTermsDays: 14,
  });

  useEffect(() => {
    supabase
      .from("profiles")
      .select("tax_rate, invoice_number_prefix, next_invoice_number, default_payment_terms_days")
      .single()
      .then(({ data }) => {
        if (!data) return;
        setTaxRate(Number(data.tax_rate));
        setInvoiceDefaults({
          invoiceNumberPrefix: data.invoice_number_prefix ?? "",
          nextInvoiceNumber: data.next_invoice_number ?? 1,
          paymentTermsDays: data.default_payment_terms_days ?? 14,
        });
      });
  }, []);

  function mergeParsedItems(parsed: DraftLineItem[]) {
    setItems((current) => [
      ...current,
      ...parsed.map((item) => ({ ...item, id: item.id || randomUUID() })),
    ]);
  }

  function addExpenseLine() {
    if (!expenseDescription.trim()) return;
    setItems((current) => [
      ...current,
      { id: randomUUID(), description: expenseDescription.trim(), quantity: 1, unit_price: toNumber(expenseAmount) },
    ]);
    setExpenseDescription("");
    setExpenseAmount("");
  }

  async function handleCreate() {
    setError(null);

    if (items.length === 0) {
      setError("Add at least one line item first.");
      return;
    }

    setIsSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError("You must be signed in.");
      setIsSaving(false);
      return;
    }

    const invoiceNumber = `${invoiceDefaults.invoiceNumberPrefix}${invoiceDefaults.nextInvoiceNumber}`;

    const { data: estimate, error: insertError } = await supabase
      .from("estimates")
      .insert({
        user_id: userData.user.id,
        client_id: client?.id ?? null,
        job_address: jobAddress || null,
        notes: notes.trim() || null,
        tax_rate: taxRate,
        discount_type: discountType,
        discount_value: toNumber(discountValue),
        invoice_number: invoiceNumber,
        status: isQuickInvoice ? "invoiced" : "draft",
        due_at: isQuickInvoice
          ? new Date(Date.now() + invoiceDefaults.paymentTermsDays * 24 * 60 * 60 * 1000).toISOString()
          : null,
      })
      .select()
      .single();

    if (insertError || !estimate) {
      setIsSaving(false);
      setError(insertError?.message ?? "Could not create the estimate.");
      return;
    }

    await supabase
      .from("profiles")
      .update({ next_invoice_number: invoiceDefaults.nextInvoiceNumber + 1 })
      .eq("user_id", userData.user.id);

    const { error: lineItemsError } = await supabase.from("line_items").insert(
      items.map((item, index) => ({
        estimate_id: estimate.id,
        description: item.description || "Untitled item",
        quantity: item.quantity,
        unit_price: item.unit_price,
        sort_order: index,
      }))
    );

    setIsSaving(false);
    if (lineItemsError) {
      setError(lineItemsError.message);
      return;
    }

    router.replace(`/(tabs)/estimates/${estimate.id}`);
  }

  return (
    <Screen>
      <Text className="text-lg font-bold text-ink">
        {isQuickInvoice ? "Quick invoice" : "New estimate"}
      </Text>

      {!isQuickInvoice && (
        <>
          <VoiceCapture onParsed={mergeParsedItems} />
          <PhotoCapture onParsed={mergeParsedItems} />
        </>
      )}

      <Card className="gap-3">
        <Text className="text-sm font-semibold text-ink">Client (optional)</Text>
        <ClientPicker value={client} onChange={setClient} />
        <Input label="Job address" value={jobAddress} onChangeText={setJobAddress} />
        <Input label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />
      </Card>

      <Card className="gap-3">
        <Text className="text-sm font-semibold text-ink">Add an expense</Text>
        <Text className="text-xs text-subtle">
          Adds a line item to this estimate. To also track it for profit reporting, log it from the
          Expenses tab instead (once this estimate is saved, you can link it there).
        </Text>
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Input
              placeholder="Description"
              value={expenseDescription}
              onChangeText={setExpenseDescription}
            />
          </View>
          <View className="w-24">
            <Input placeholder="$0.00" value={expenseAmount} onChangeText={setExpenseAmount} keyboardType="decimal-pad" />
          </View>
        </View>
        <Button label="Add expense line" variant="secondary" onPress={addExpenseLine} />
      </Card>

      <Card className="gap-3">
        <Text className="text-sm font-semibold text-ink">Line items</Text>
        <LineItemsEditor
          items={items}
          taxRate={taxRate}
          discount={{ type: discountType, value: toNumber(discountValue) }}
          onChange={setItems}
        />
      </Card>

      <Card className="gap-3">
        <Text className="text-sm font-semibold text-ink">Discount</Text>
        <View className="flex-row gap-2">
          {DISCOUNT_TYPES.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => setDiscountType(option.value)}
              className={`rounded-full border px-3.5 py-2 ${
                discountType === option.value ? "border-brand-600 bg-brand-50" : "border-border bg-surface"
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  discountType === option.value ? "text-brand-600" : "text-subtle"
                }`}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Input label="Amount" value={discountValue} onChangeText={setDiscountValue} keyboardType="decimal-pad" />
      </Card>

      {error && <Text className="text-sm text-danger">{error}</Text>}

      <View className="pb-4">
        <Button
          label={isQuickInvoice ? "Create invoice" : "Create estimate"}
          onPress={handleCreate}
          loading={isSaving}
        />
      </View>
    </Screen>
  );
}

function toNumber(text: string) {
  const cleaned = text.replace(/[^0-9.]/g, "");
  const value = parseFloat(cleaned);
  return Number.isFinite(value) ? value : 0;
}
