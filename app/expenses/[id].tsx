import { useCallback, useState } from "react";
import { Text } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { ExpenseForm } from "@/components/expenses/ExpenseForm";
import { supabase } from "@/lib/supabase";
import { confirmAsync } from "@/lib/confirm";
import type { Client, Expense } from "@/types/database";

export default function ExpenseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      supabase
        .from("expenses")
        .select("*, clients ( * )")
        .eq("id", id)
        .single()
        .then(({ data }) => {
          if (!isActive || !data) return;
          const { clients: loadedClient, ...rest } = data as any;
          setExpense(rest);
          setClient(loadedClient);
        });
      return () => {
        isActive = false;
      };
    }, [id])
  );

  async function handleDelete() {
    const confirmed = await confirmAsync("This permanently deletes the expense.");
    if (!confirmed) return;

    setIsDeleting(true);
    await supabase.from("expenses").delete().eq("id", id);
    setIsDeleting(false);
    router.back();
  }

  if (!expense) {
    return (
      <Screen>
        <Text className="mt-10 text-center text-sm text-subtle">Loading…</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <ExpenseForm
        expense={expense}
        initialClient={client}
        estimateId={expense.estimate_id ?? undefined}
        onSaved={() => router.back()}
      />
      <Button label="Delete expense" variant="destructive" onPress={handleDelete} loading={isDeleting} />
    </Screen>
  );
}
