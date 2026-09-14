import { useRouter, useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { AppointmentForm } from "@/components/schedule/AppointmentForm";

export default function NewAppointmentScreen() {
  const router = useRouter();
  const { estimateId } = useLocalSearchParams<{ estimateId?: string }>();

  return (
    <Screen>
      <AppointmentForm estimateId={estimateId} onSaved={() => router.back()} />
    </Screen>
  );
}
