import { useRouter, useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { AppointmentForm } from "@/components/schedule/AppointmentForm";

export default function NewAppointmentScreen() {
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date?: string }>();

  return (
    <Screen>
      <AppointmentForm initialDate={date} onSaved={() => router.back()} />
    </Screen>
  );
}
