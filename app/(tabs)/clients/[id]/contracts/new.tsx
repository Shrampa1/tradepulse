import { useRouter, useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { ContractForm } from "@/components/contracts/ContractForm";

export default function NewContractScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Screen>
      <ContractForm clientId={id} onSaved={() => router.back()} />
    </Screen>
  );
}
