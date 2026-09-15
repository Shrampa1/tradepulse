import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useColorScheme } from "nativewind";
import { Trash2, Plus } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Screen } from "@/components/ui/Screen";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import { setCurrentCurrency } from "@/lib/format";
import type { CustomInvoiceField } from "@/types/database";

const CURRENCIES = ["USD", "PKR", "GBP", "EUR"];
const THEMES: { value: "light" | "dark" | "system"; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export default function SettingsScreen() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const [businessName, setBusinessName] = useState("");
  const [businessTagline, setBusinessTagline] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [businessFax, setBusinessFax] = useState("");
  const [customFields, setCustomFields] = useState<CustomInvoiceField[]>([]);
  const [taxRatePercent, setTaxRatePercent] = useState("0");
  const [mileageRate, setMileageRate] = useState("0.670");
  const [invoiceNumberPrefix, setInvoiceNumberPrefix] = useState("");
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState("1");
  const [paymentTermsDays, setPaymentTermsDays] = useState("14");
  const [currency, setCurrency] = useState("USD");
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
          setCustomFields(data.custom_invoice_fields ?? []);
          setTaxRatePercent(String(Number(data.tax_rate) * 100));
          setMileageRate(String(Number(data.mileage_rate)));
          setInvoiceNumberPrefix(data.invoice_number_prefix ?? "");
          setNextInvoiceNumber(String(data.next_invoice_number ?? 1));
          setPaymentTermsDays(String(data.default_payment_terms_days ?? 14));
          setCurrency(data.currency ?? "USD");
          setIsLoading(false);
        });
      return () => {
        isActive = false;
      };
    }, [])
  );

  function addCustomField() {
    setCustomFields((current) => [...current, { label: "", value: "" }]);
  }

  function updateCustomField(index: number, patch: Partial<CustomInvoiceField>) {
    setCustomFields((current) => current.map((field, i) => (i === index ? { ...field, ...patch } : field)));
  }

  function removeCustomField(index: number) {
    setCustomFields((current) => current.filter((_, i) => i !== index));
  }

  async function handleThemeChange(next: "light" | "dark" | "system") {
    setColorScheme(next);
    await AsyncStorage.setItem("theme-preference", next);
  }

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
        custom_invoice_fields: customFields.filter((field) => field.label.trim()),
        tax_rate: toNumber(taxRatePercent) / 100,
        mileage_rate: toNumber(mileageRate),
        invoice_number_prefix: invoiceNumberPrefix.trim(),
        next_invoice_number: Math.max(1, Math.round(toNumber(nextInvoiceNumber))),
        default_payment_terms_days: Math.max(0, Math.round(toNumber(paymentTermsDays))),
        currency,
      })
      .eq("user_id", userData.user.id);

    setIsSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setCurrentCurrency(currency);
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

        <Text className="mt-1 text-sm font-semibold text-ink">Custom fields</Text>
        <Text className="text-xs text-subtle">Extra lines shown on your invoices — license #, website, etc.</Text>
        {customFields.map((field, index) => (
          <View key={index} className="flex-row items-end gap-2">
            <View className="flex-1">
              <Input
                label="Label"
                value={field.label}
                onChangeText={(text) => updateCustomField(index, { label: text })}
                placeholder="License #"
              />
            </View>
            <View className="flex-1">
              <Input
                label="Value"
                value={field.value}
                onChangeText={(text) => updateCustomField(index, { value: text })}
              />
            </View>
            <Pressable onPress={() => removeCustomField(index)} className="mb-3 p-2" hitSlop={8}>
              <Trash2 size={18} color="#dc2626" />
            </Pressable>
          </View>
        ))}
        <Pressable
          onPress={addCustomField}
          className="flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3"
        >
          <Plus size={16} color="#2563eb" />
          <Text className="text-sm font-semibold text-brand-600">Add custom field</Text>
        </Pressable>
      </Card>

      <Card className="gap-3">
        <Text className="text-sm font-semibold text-ink">Invoicing defaults</Text>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Input label="Invoice # prefix" value={invoiceNumberPrefix} onChangeText={setInvoiceNumberPrefix} placeholder="INV-" />
          </View>
          <View className="flex-1">
            <Input
              label="Next number"
              value={nextInvoiceNumber}
              onChangeText={setNextInvoiceNumber}
              keyboardType="number-pad"
            />
          </View>
        </View>
        <Input
          label="Payment terms (days until due)"
          value={paymentTermsDays}
          onChangeText={setPaymentTermsDays}
          keyboardType="number-pad"
        />
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

      <Card className="gap-3">
        <Text className="text-sm font-semibold text-ink">Currency</Text>
        <View className="flex-row flex-wrap gap-2">
          {CURRENCIES.map((code) => (
            <Pressable
              key={code}
              onPress={() => setCurrency(code)}
              className={`rounded-full border px-3.5 py-2 ${
                currency === code ? "border-brand-600 bg-brand-50" : "border-border bg-surface"
              }`}
            >
              <Text className={`text-sm font-medium ${currency === code ? "text-brand-600" : "text-subtle"}`}>
                {code}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text className="text-xs text-subtle">
          Only changes how amounts display in your own app — the customer-facing invoice page always shows
          whatever currency your Safepay account actually charges in.
        </Text>
      </Card>

      <Card className="gap-3">
        <Text className="text-sm font-semibold text-ink">Appearance</Text>
        <View className="flex-row gap-2">
          {THEMES.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => handleThemeChange(option.value)}
              className={`flex-1 items-center rounded-xl border px-3.5 py-2.5 ${
                colorScheme === option.value || (option.value === "system" && !colorScheme)
                  ? "border-brand-600 bg-brand-50"
                  : "border-border bg-surface"
              }`}
            >
              <Text className="text-sm font-medium text-ink">{option.label}</Text>
            </Pressable>
          ))}
        </View>
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
