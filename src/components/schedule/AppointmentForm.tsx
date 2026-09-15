import { useState } from "react";
import { Text, View } from "react-native";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { NativePickerField } from "@/components/ui/NativePickerField";
import { ClientPicker } from "@/components/clients/ClientPicker";
import { EstimatePicker, type EstimateOption } from "@/components/estimates/EstimatePicker";
import { supabase } from "@/lib/supabase";
import type { Appointment, Client } from "@/types/database";

type Props = {
  appointment?: Appointment;
  initialDate?: string; // YYYY-MM-DD, used when creating from a selected calendar day
  initialClient?: Client | null;
  initialEstimate?: EstimateOption | null;
  onSaved: (appointment: Appointment) => void;
};

export function AppointmentForm({
  appointment,
  initialDate,
  initialClient,
  initialEstimate,
  onSaved,
}: Props) {
  const isEditing = Boolean(appointment);
  const [title, setTitle] = useState(appointment?.title ?? "");
  const [date, setDate] = useState(
    appointment ? appointment.starts_at.slice(0, 10) : initialDate ?? new Date().toISOString().slice(0, 10)
  );
  const [startTime, setStartTime] = useState(appointment ? splitTime(appointment.starts_at) : "09:00");
  const [endTime, setEndTime] = useState(appointment ? splitTime(appointment.ends_at) : "");
  const [location, setLocation] = useState(appointment?.location ?? "");
  const [notes, setNotes] = useState(appointment?.notes ?? "");
  const [client, setClient] = useState<Client | null>(initialClient ?? null);
  const [estimate, setEstimate] = useState<EstimateOption | null>(initialEstimate ?? null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function handlePickEstimate(picked: EstimateOption) {
    setEstimate(picked);
    // Estimates only carry the client's name via the join, not a full Client
    // row, but that's enough for ClientPicker's display + for linking below.
    if (!client && picked.clients) {
      setClient({ id: picked.client_id, name: picked.clients.name } as Client);
    }
  }

  function handlePickClient(picked: Client) {
    setClient(picked);
    // Only prefill — never clobber a location the user already typed.
    if (!location && picked.address) setLocation(picked.address);
  }

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

    const payload = {
      estimate_id: estimate?.id ?? null,
      client_id: client?.id ?? null,
      title: title.trim(),
      starts_at: startsAt.toISOString(),
      ends_at: endsAt ? endsAt.toISOString() : null,
      location: location.trim() || null,
      notes: notes.trim() || null,
    };

    if (isEditing && appointment) {
      const { data, error: updateError } = await supabase
        .from("appointments")
        .update(payload)
        .eq("id", appointment.id)
        .select()
        .single();
      setIsSaving(false);
      if (updateError) {
        setError(updateError.message);
        return;
      }
      onSaved(data as Appointment);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError("You must be signed in.");
      setIsSaving(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("appointments")
      .insert({ ...payload, user_id: userData.user.id })
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

      <NativePickerField label="Date" mode="date" value={date} onChange={setDate} />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <NativePickerField label="Start time" mode="time" value={startTime} onChange={setStartTime} />
        </View>
        <View className="flex-1">
          <NativePickerField label="End time" mode="time" value={endTime} onChange={setEndTime} />
        </View>
      </View>

      <Input label="Location" value={location} onChangeText={setLocation} placeholder="123 Main St" />
      <Input label="Notes" value={notes} onChangeText={setNotes} multiline />

      <View className="gap-1.5">
        <Text className="text-sm font-medium text-ink">Client (optional)</Text>
        <ClientPicker value={client} onChange={handlePickClient} />
      </View>

      <View className="gap-1.5">
        <Text className="text-sm font-medium text-ink">Linked estimate (optional)</Text>
        <EstimatePicker value={estimate} onChange={handlePickEstimate} />
      </View>

      {error && <Text className="text-sm text-danger">{error}</Text>}
      <Button
        label={isEditing ? "Save changes" : "Save appointment"}
        onPress={handleSave}
        loading={isSaving}
      />
    </View>
  );
}

function splitTime(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function combineDateAndTime(date: string, time: string): Date | null {
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
