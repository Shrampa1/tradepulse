import { useRouter, useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { ExpenseForm } from "@/components/expenses/ExpenseForm";

export default function NewExpenseScreen() {
  const router = useRouter();
  const { estimateId } = useLocalSearchParams<{ estimateId?: string }>();

  return (
    <Screen>
      <ExpenseForm estimateId={estimateId} onSaved={() => router.back()} />
    </Screen>
  );
}
