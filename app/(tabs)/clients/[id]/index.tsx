import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Client, Estimate } from "@/types/database";

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      Promise.all([
        supabase.from("clients").select("*").eq("id", id).single(),
        supabase
          .from("estimates")
          .select("*")
          .eq("client_id", id)
          .order("created_at", { ascending: false }),
      ]).then(([clientRes, estimatesRes]) => {
        if (!isActive) return;
        if (clientRes.data) {
          setClient(clientRes.data);
          setName(clientRes.data.name);
          setPhone(clientRes.data.phone ?? "");
          setEmail(clientRes.data.email ?? "");
          setAddress(clientRes.data.address ?? "");
        }
        setEstimates(estimatesRes.data ?? []);
      });
      return () => {
        isActive = false;
      };
    }, [id])
  );

  async function handleSave() {
    if (!client) return;
    setIsSaving(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("clients")
      .update({
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
      })
      .eq("id", client.id);
    setIsSaving(false);
    if (updateError) setError(updateError.message);
  }

  if (!client) {
    return (
      <Screen>
        <Text className="mt-10 text-center text-sm text-subtle">Loading…</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text className="mt-2 text-2xl font-bold text-ink">{client.name}</Text>

      <Card className="gap-3">
        <Input label="Name" value={name} onChangeText={setName} />
        <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <Input label="Address" value={address} onChangeText={setAddress} />
        {error && <Text className="text-sm text-danger">{error}</Text>}
        <Button label="Save" onPress={handleSave} loading={isSaving} />
      </Card>

      <Text className="text-sm font-semibold text-ink">Estimates & invoices</Text>
      <FlatList
        data={estimates}
        scrollEnabled={false}
        keyExtractor={(item) => item.id}
        contentContainerClassName="gap-2"
        ListEmptyComponent={<Text className="text-sm text-subtle">No estimates for this client yet.</Text>}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/(tabs)/estimates/${item.id}`)}
            className="flex-row items-center justify-between rounded-xl border border-border bg-surface p-3"
          >
            <View>
              <Text className="text-sm text-ink">{formatDate(item.created_at)}</Text>
              <StatusBadge status={item.status} />
            </View>
            <Text className="text-base font-semibold text-ink">{formatCurrency(item.total_amount)}</Text>
          </Pressable>
        )}
      />
    </Screen>
  );
}
