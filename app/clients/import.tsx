import { useState } from "react";
import { FlatList, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { Screen } from "@/components/ui/Screen";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";

type ParsedRow = { name: string; phone: string; email: string; address: string };

export default function ImportClientsScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  async function handlePickFile() {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({ type: ["text/csv", "text/comma-separated-values"] });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    try {
      const text = await (await fetch(asset.uri)).text();
      const parsed = parseCsv(text);
      if (parsed.length === 0) {
        setError("No rows found — make sure the first row has headers (name, phone, email, address).");
        return;
      }
      setRows(parsed);
      setFileName(asset.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that file.");
    }
  }

  async function handleImport() {
    setIsImporting(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError("You must be signed in.");
      setIsImporting(false);
      return;
    }

    const { error: insertError } = await supabase.from("clients").insert(
      rows.map((row) => ({
        user_id: userData.user!.id,
        name: row.name,
        phone: row.phone || null,
        email: row.email || null,
        address: row.address || null,
      }))
    );

    setIsImporting(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    router.back();
  }

  return (
    <Screen>
      <Text className="text-sm text-subtle">
        Pick a .csv file with a header row of name, phone, email, address (only "name" is required).
      </Text>

      <Button label={fileName ?? "Choose CSV file"} variant="secondary" onPress={handlePickFile} />

      {error && <Text className="text-sm text-danger">{error}</Text>}

      {rows.length > 0 && (
        <Card className="gap-2">
          <Text className="text-sm font-semibold text-ink">{rows.length} clients found</Text>
          <FlatList
            data={rows}
            scrollEnabled={false}
            keyExtractor={(_, index) => String(index)}
            contentContainerClassName="gap-2"
            renderItem={({ item }) => (
              <View className="rounded-xl border border-border bg-muted p-3">
                <Text className="text-sm font-semibold text-ink">{item.name || "(no name)"}</Text>
                {(item.phone || item.email) && (
                  <Text className="text-xs text-subtle">{[item.phone, item.email].filter(Boolean).join(" · ")}</Text>
                )}
              </View>
            )}
          />
        </Card>
      )}

      <View className="pb-4">
        <Button
          label={`Import ${rows.length || ""} client${rows.length === 1 ? "" : "s"}`.trim()}
          onPress={handleImport}
          loading={isImporting}
          disabled={rows.length === 0}
        />
      </View>
    </Screen>
  );
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((header) => header.trim().toLowerCase());
  const nameIndex = headers.indexOf("name");
  const phoneIndex = headers.indexOf("phone");
  const emailIndex = headers.indexOf("email");
  const addressIndex = headers.indexOf("address");
  if (nameIndex === -1) return [];

  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((cell) => cell.trim());
    return {
      name: cells[nameIndex] ?? "",
      phone: phoneIndex >= 0 ? cells[phoneIndex] ?? "" : "",
      email: emailIndex >= 0 ? cells[emailIndex] ?? "" : "",
      address: addressIndex >= 0 ? cells[addressIndex] ?? "" : "",
    };
  }).filter((row) => row.name);
}
