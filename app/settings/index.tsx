import { useCallback, useState } from "react";
import { Text } from "react-native";
import { useFocusEffect } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";

export default function SettingsScreen() {
  const [businessName, setBusinessName] = useState("");
  const [businessTagline, setBusinessTagline] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [businessFax, setBusinessFax] = useState("");
  const [taxRatePercent, setTaxRatePercent] = useState("0");
  const [mileageRate, setMileageRate] = useState("0.670");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      supabase
        .from("profiles")
        .select("*")
        .single()
        .then(({ data }) => {
          if (!isActive || !data) return;
          setBusinessName(data.business_name ?? "");
          setBusinessTagline(data.business_tagline ?? "");
          setBusinessAddress(data.business_address ?? "");
          setPhone(data.phone ?? "");
          setBusinessFax(data.business_fax ?? "");
          setTaxRatePercent(String(Number(data.tax_rate) * 100));
          setMileageRate(String(Number(data.mileage_rate)));
          setIsLoading(false);
        });
      return () => {
        isActive = false;
      };
    }, [])
  );

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    setSaved(false);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError("You must be signed in.");
      setIsSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        business_name: businessName.trim(),
        business_tagline: businessTagline.trim() || null,
        business_address: businessAddress.trim() || null,
        phone: phone.trim() || null,
        business_fax: businessFax.trim() || null,
        tax_rate: toNumber(taxRatePercent) / 100,
        mileage_rate: toNumber(mileageRate),
      })
      .eq("user_id", userData.user.id);

    setIsSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSaved(true);
  }

  if (isLoading) {
    return (
      <Screen>
        <Text className="mt-10 text-center text-sm text-subtle">Loading…</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card className="gap-3">
        <Text className="text-sm font-semibold text-ink">Invoice letterhead</Text>
        <Input label="Business name" value={businessName} onChangeText={setBusinessName} />
        <Input
          label="Tagline (optional)"
          value={businessTagline}
          onChangeText={setBusinessTagline}
          placeholder="Licensed & Insured General Contractor"
        />
        <Input label="Business address" value={businessAddress} onChangeText={setBusinessAddress} />
        <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Input label="Fax (optional)" value={businessFax} onChangeText={setBusinessFax} keyboardType="phone-pad" />
      </Card>

      <Card className="gap-3">
        <Text className="text-sm font-semibold text-ink">Defaults</Text>
        <Input
          label="Default tax rate (%)"
          value={taxRatePercent}
          onChangeText={setTaxRatePercent}
          keyboardType="decimal-pad"
        />
        <Input
          label="Mileage rate ($/mi)"
          value={mileageRate}
          onChangeText={setMileageRate}
          keyboardType="decimal-pad"
        />
      </Card>

      {error && <Text className="text-sm text-danger">{error}</Text>}
      {saved && <Text className="text-sm text-success">Settings saved.</Text>}
      <Button label="Save settings" onPress={handleSave} loading={isSaving} />
    </Screen>
  );
}

function toNumber(text: string) {
  const value = parseFloat(text.replace(/[^0-9.]/g, ""));
  return Number.isFinite(value) ? value : 0;
}
