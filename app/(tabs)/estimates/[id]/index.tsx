import { useCallback, useState } from "react";
import { Share, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ClientPicker } from "@/components/clients/ClientPicker";
import { LineItemsEditor } from "@/components/estimates/LineItemsEditor";
import { supabase } from "@/lib/supabase";
import { sendEstimateToClient } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Client, DraftLineItem, Estimate } from "@/types/database";

export default function EstimateDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [items, setItems] = useState<DraftLineItem[]>([]);
  const [jobAddress, setJobAddress] = useState("");
  const [depositAmount, setDepositAmount] = useState("0");
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
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
        const { data } = await supabase
          .from("estimates")
          .select("*, clients ( * ), line_items ( * )")
          .eq("id", id)
          .single();
        if (!isActive || !data) return;

        const { clients: loadedClient, line_items: loadedItems, ...rest } = data as any;
        setEstimate(rest);
        setClient(loadedClient);
        setJobAddress(rest.job_address ?? "");
        setDepositAmount(String(rest.deposit_amount ?? 0));
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

  async function handleSave() {
    if (!estimate) return;
    setIsSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("estimates")
      .update({
        client_id: client?.id ?? null,
        job_address: jobAddress || null,
        deposit_amount: toNumber(depositAmount),
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
        <Text className="text-2xl font-bold text-ink">Estimate</Text>
        <StatusBadge status={estimate.status} />
      </View>

      <Card className="gap-3">
        <Text className="text-sm font-semibold text-ink">Client</Text>
        <ClientPicker value={client} onChange={setClient} />
        <Input label="Job address" value={jobAddress} onChangeText={setJobAddress} />
      </Card>

      <Card className="gap-3">
        <Text className="text-sm font-semibold text-ink">Line items</Text>
        <LineItemsEditor items={items} taxRate={estimate.tax_rate} onChange={setItems} />
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

      {error && <Text className="text-sm text-danger">{error}</Text>}

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
