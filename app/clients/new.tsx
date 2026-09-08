import { useRouter } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { ClientForm } from "@/components/clients/ClientForm";

export default function NewClientScreen() {
  const router = useRouter();

  return (
    <Screen>
      <ClientForm onSaved={() => router.back()} />
    </Screen>
  );
}
