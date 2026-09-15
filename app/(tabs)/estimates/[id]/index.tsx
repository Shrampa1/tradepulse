import { useCallback, useState } from "react";
import { Linking, Pressable, Share, Text, View } from "react-native";
import { randomUUID } from "expo-crypto";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ClientPicker } from "@/components/clients/ClientPicker";
import { LineItemsEditor } from "@/components/estimates/LineItemsEditor";
import { supabase } from "@/lib/supabase";
import { sendEstimateToClient } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import type {
  Client,
  DraftLineItem,
  Estimate,
  EstimateDiscountType,
  Expense,
} from "@/types/database";

const DISCOUNT_TYPES: { value: EstimateDiscountType; label: string }[] = [
  { value: "fixed", label: "$ Fixed" },
  { value: "percent", label: "% Percent" },
];

export default function EstimateDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [items, setItems] = useState<DraftLineItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [jobAddress, setJobAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [depositAmount, setDepositAmount] = useState("0");
  const [discountType, setDiscountType] = useState<EstimateDiscountType>("fixed");
  const [discountValue, setDiscountValue] = useState("0");
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isPreparingPdf, setIsPreparingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      load();
      return () => {
        isActive = false;
      };

      async function load() {
        const [{ data }, { data: expenseRows }] = await Promise.all([
          supabase
            .from("estimates")
            .select("*, clients ( * ), line_items ( * )")
            .eq("id", id)
            .single(),
          supabase.from("expenses").select("*").eq("estimate_id", id),
        ]);
        if (!isActive || !data) return;

        const { clients: loadedClient, line_items: loadedItems, ...rest } = data as any;
        setEstimate(rest);
        setClient(loadedClient);
        setExpenses(expenseRows ?? []);
        setJobAddress(rest.job_address ?? "");
        setNotes(rest.notes ?? "");
        setDepositAmount(String(rest.deposit_amount ?? 0));
        setDiscountType(rest.discount_type ?? "fixed");
        setDiscountValue(String(rest.discount_value ?? 0));
        setItems(
          (loadedItems ?? [])
            .sort((a: any, b: any) => a.sort_order - b.sort_order)
            .map((item: any) => ({
              id: item.id,
              description: item.description,
              quantity: Number(item.quantity),
              unit_price: Number(item.unit_price),
            }))
        );
      }
    }, [id])
  );

  const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const profit = (estimate?.total_amount ?? 0) - totalExpenses;

  async function handleSave() {
    if (!estimate) return;
    setIsSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("estimates")
      .update({
        client_id: client?.id ?? null,
        job_address: jobAddress || null,
        notes: notes.trim() || null,
        deposit_amount: toNumber(depositAmount),
        discount_type: discountType,
        discount_value: toNumber(discountValue),
      })
      .eq("id", estimate.id);

    // Simplest correct way to persist an editable list with adds/edits/removes:
    // replace the full set for this estimate rather than diffing row-by-row.
    const { error: deleteError } = await supabase.from("line_items").delete().eq("estimate_id", estimate.id);
    const { error: insertError } = items.length
      ? await supabase.from("line_items").insert(
          items.map((item, index) => ({
            estimate_id: estimate.id,
            description: item.description || "Untitled item",
            quantity: item.quantity,
            unit_price: item.unit_price,
            sort_order: index,
          }))
        )
      : { error: null };

    setIsSaving(false);
    const firstError = updateError ?? deleteError ?? insertError;
    if (firstError) setError(firstError.message);
  }

  function billExpenseToInvoice(expense: Expense) {
    setItems((current) => [
      ...current,
      {
        id: randomUUID(),
        description: `Reimbursed: ${expense.description}`,
        quantity: 1,
        unit_price: Number(expense.amount),
      },
    ]);
  }

  function quoteUrl() {
    if (!estimate) return null;
    return `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/public-quote?token=${estimate.public_token}`;
  }

  function handlePreview() {
    const url = quoteUrl();
    if (url) Linking.openURL(url);
  }

  async function handleDownloadPdf() {
    const url = quoteUrl();
    if (!url) return;
    setIsPreparingPdf(true);
    setError(null);
    try {
      const { uri } = await Print.printToFileAsync({ uri: url });
      await Sharing.shareAsync(uri, { mimeType: "application/pdf" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate the PDF.");
    } finally {
      setIsPreparingPdf(false);
    }
  }

  async function handleSend() {
    if (!estimate) return;
    setIsSending(true);
    setError(null);
    try {
      await handleSave();
      const { publicUrl: url } = await sendEstimateToClient(estimate.id);
      setPublicUrl(url);
      await Share.share({ message: `Here's your quote: ${url}` });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the estimate.");
    } finally {
      setIsSending(false);
    }
  }

  if (!estimate) {
    return (
      <Screen>
        <Text className="mt-10 text-center text-sm text-subtle">Loading…</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-bold text-ink">Estimate</Text>
          {estimate.invoice_number && (
            <Text className="text-xs text-subtle">#{estimate.invoice_number}</Text>
          )}
        </View>
        <StatusBadge status={estimate.status} />
      </View>

      <Card className="gap-3">
        <Text className="text-sm font-semibold text-ink">Client</Text>
        <ClientPicker value={client} onChange={setClient} />
        <Input label="Job address" value={jobAddress} onChangeText={setJobAddress} />
        <Input label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />
      </Card>

      <Card className="gap-3">
        <Text className="text-sm font-semibold text-ink">Line items</Text>
        <LineItemsEditor
          items={items}
          taxRate={estimate.tax_rate}
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

      <Card className="gap-3">
        <Input
          label="Deposit amount"
          value={depositAmount}
          onChangeText={setDepositAmount}
          keyboardType="decimal-pad"
        />
        {estimate.sent_at && (
          <Text className="text-xs text-subtle">Sent {formatDate(estimate.sent_at)}</Text>
        )}
        {(publicUrl ?? null) && (
          <Text className="text-xs text-brand-600">{publicUrl}</Text>
        )}
      </Card>

      <Card className="gap-2">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-ink">Profit</Text>
          <Text className={`text-lg font-bold ${profit >= 0 ? "text-success" : "text-danger"}`}>
            {formatCurrency(profit)}
          </Text>
        </View>
        <Text className="text-xs text-subtle">
          {formatCurrency(estimate.total_amount)} total − {formatCurrency(totalExpenses)} in expenses
        </Text>

        {expenses.map((expense) => (
          <View
            key={expense.id}
            className="flex-row items-center justify-between rounded-xl border border-border bg-muted px-3 py-2"
          >
            <View className="flex-1 pr-2">
              <Text className="text-sm text-ink">{expense.description}</Text>
              <Text className="text-xs text-subtle">{formatCurrency(Number(expense.amount))}</Text>
            </View>
            <Pressable
              onPress={() => billExpenseToInvoice(expense)}
              className="rounded-lg border border-brand-600 px-2.5 py-1.5"
            >
              <Text className="text-xs font-semibold text-brand-600">Bill to invoice</Text>
            </Pressable>
          </View>
        ))}

        <Button
          label="Add expense"
          variant="secondary"
          onPress={() => router.push({ pathname: "/expenses/new", params: { estimateId: estimate.id } })}
        />
      </Card>

      {error && <Text className="text-sm text-danger">{error}</Text>}

      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button label="Preview" variant="secondary" onPress={handlePreview} />
        </View>
        <View className="flex-1">
          <Button
            label="Download PDF"
            variant="secondary"
            onPress={handleDownloadPdf}
            loading={isPreparingPdf}
          />
        </View>
      </View>

      <View className="gap-2 pb-4">
        <Button label="Send to client" onPress={handleSend} loading={isSending} />
        <Button label="Save changes" variant="secondary" onPress={handleSave} loading={isSaving} />
      </View>
    </Screen>
  );
}

function toNumber(text: string) {
  const value = parseFloat(text.replace(/[^0-9.]/g, ""));
  return Number.isFinite(value) ? value : 0;
}
