import { useState } from "react";
import { Text, View } from "react-native";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ClientPicker } from "@/components/clients/ClientPicker";
import { supabase } from "@/lib/supabase";
import type { Appointment, Client } from "@/types/database";

type Props = {
  estimateId?: string;
  onSaved: (appointment: Appointment) => void;
};

export function AppointmentForm({ estimateId, onSaved }: Props) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [client, setClient] = useState<Client | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    const startsAt = combineDateAndTime(date, startTime);
    if (!startsAt) {
      setError("Enter a valid date (YYYY-MM-DD) and start time (HH:MM).");
      return;
    }
    const endsAt = endTime ? combineDateAndTime(date, endTime) : null;

    setIsSaving(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError("You must be signed in.");
      setIsSaving(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("appointments")
      .insert({
        user_id: userData.user.id,
        estimate_id: estimateId ?? null,
        client_id: client?.id ?? null,
        title: title.trim(),
        starts_at: startsAt.toISOString(),
        ends_at: endsAt ? endsAt.toISOString() : null,
        location: location.trim() || null,
        notes: notes.trim() || null,
      })
      .select()
      .single();

    setIsSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    onSaved(data as Appointment);
  }

  return (
    <View className="gap-3">
      <Input label="Title" value={title} onChangeText={setTitle} placeholder="Fence repair" />

      <View className="flex-row gap-3">
        <View className="flex-1">
          <Input label="Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
        </View>
        <View className="flex-1">
          <Input label="Start time" value={startTime} onChangeText={setStartTime} placeholder="09:00" />
        </View>
        <View className="flex-1">
          <Input label="End time" value={endTime} onChangeText={setEndTime} placeholder="11:00" />
        </View>
      </View>

      <Input label="Location" value={location} onChangeText={setLocation} placeholder="123 Main St" />
      <Input label="Notes" value={notes} onChangeText={setNotes} multiline />

      {!estimateId && (
        <View className="gap-1.5">
          <Text className="text-sm font-medium text-ink">Client (optional)</Text>
          <ClientPicker value={client} onChange={setClient} />
        </View>
      )}

      {error && <Text className="text-sm text-danger">{error}</Text>}
      <Button label="Save appointment" onPress={handleSave} loading={isSaving} />
    </View>
  );
}

function combineDateAndTime(date: string, time: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match || !timeMatch) return null;

  const [, year, month, day] = match;
  const [, hours, minutes] = timeMatch;
  const result = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes)
  );
  return Number.isNaN(result.getTime()) ? null : result;
}
