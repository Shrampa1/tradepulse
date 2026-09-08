import { useEffect, useState } from "react";
import { Text, View } from "react-native";
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
import type { Client, DraftLineItem } from "@/types/database";

export default function NewEstimateScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isQuickInvoice = mode === "invoice";
  const router = useRouter();

  const [client, setClient] = useState<Client | null>(null);
  const [jobAddress, setJobAddress] = useState("");
  const [items, setItems] = useState<DraftLineItem[]>([]);
  const [taxRate, setTaxRate] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("tax_rate")
      .single()
      .then(({ data }) => {
        if (data) setTaxRate(Number(data.tax_rate));
      });
  }, []);

  function mergeParsedItems(parsed: DraftLineItem[]) {
    setItems((current) => [
      ...current,
      ...parsed.map((item) => ({ ...item, id: item.id || randomUUID() })),
    ]);
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

    const { data: estimate, error: insertError } = await supabase
      .from("estimates")
      .insert({
        user_id: userData.user.id,
        client_id: client?.id ?? null,
        job_address: jobAddress || null,
        tax_rate: taxRate,
        status: isQuickInvoice ? "invoiced" : "draft",
        due_at: isQuickInvoice ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() : null,
      })
      .select()
      .single();

    if (insertError || !estimate) {
      setIsSaving(false);
      setError(insertError?.message ?? "Could not create the estimate.");
      return;
    }

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
      </Card>

      <Card className="gap-3">
        <Text className="text-sm font-semibold text-ink">Line items</Text>
        <LineItemsEditor items={items} taxRate={taxRate} onChange={setItems} />
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
