import { useState } from "react";
import { Text, View } from "react-native";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import type { Client } from "@/types/database";

type Props = {
  onSaved: (client: Client) => void;
};

export function ClientForm({ onSaved }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      setError("Name is required.");
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
      .from("clients")
      .insert({
        user_id: userData.user.id,
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
      })
      .select()
      .single();

    setIsSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    onSaved(data as Client);
  }

  return (
    <View className="gap-3">
      <Input label="Name" value={name} onChangeText={setName} placeholder="Jane Homeowner" />
      <Input
        label="Phone"
        value={phone}
        onChangeText={setPhone}
        placeholder="(555) 123-4567"
        keyboardType="phone-pad"
      />
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="jane@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Input
        label="Job address"
        value={address}
        onChangeText={setAddress}
        placeholder="123 Main St, Springfield"
      />
      {error && <Text className="text-sm text-danger">{error}</Text>}
      <Button label="Save client" onPress={handleSave} loading={isSaving} />
    </View>
  );
}
