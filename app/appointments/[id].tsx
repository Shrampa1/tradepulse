import { useCallback, useState } from "react";
import { Text } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { AppointmentForm } from "@/components/schedule/AppointmentForm";
import { supabase } from "@/lib/supabase";
import type { Appointment, Client } from "@/types/database";
import type { EstimateOption } from "@/components/estimates/EstimatePicker";

export default function AppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [estimate, setEstimate] = useState<EstimateOption | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      supabase
        .from("appointments")
        .select("*, clients ( * ), estimates ( *, clients ( name ) )")
        .eq("id", id)
        .single()
        .then(({ data }) => {
          if (!isActive || !data) return;
          const { clients: loadedClient, estimates: loadedEstimate, ...rest } = data as any;
          setAppointment(rest);
          setClient(loadedClient);
          setEstimate(loadedEstimate);
        });
      return () => {
        isActive = false;
      };
    }, [id])
  );

  async function handleDelete() {
    setIsDeleting(true);
    await supabase.from("appointments").delete().eq("id", id);
    setIsDeleting(false);
    router.back();
  }

  if (!appointment) {
    return (
      <Screen>
        <Text className="mt-10 text-center text-sm text-subtle">Loading…</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppointmentForm
        appointment={appointment}
        initialClient={client}
        initialEstimate={estimate}
        onSaved={() => router.back()}
      />
      <Button label="Delete appointment" variant="destructive" onPress={handleDelete} loading={isDeleting} />
    </Screen>
  );
}
