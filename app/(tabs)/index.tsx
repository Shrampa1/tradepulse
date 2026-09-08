import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { FilePlus, Zap } from "lucide-react-native";
import { Screen } from "@/components/ui/Screen";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { QuickActionButton } from "@/components/dashboard/QuickActionButton";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/format";

type Metrics = {
  pendingQuotes: number;
  unpaidInvoices: number;
  revenueThisMonth: number;
};

export default function DashboardScreen() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<Metrics>({
    pendingQuotes: 0,
    unpaidInvoices: 0,
    revenueThisMonth: 0,
  });

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      loadMetrics().then((next) => {
        if (isActive) setMetrics(next);
      });
      return () => {
        isActive = false;
      };
    }, [])
  );

  return (
    <Screen>
      <Text className="mt-2 text-2xl font-bold text-ink">Dashboard</Text>

      <View className="flex-row gap-3">
        <MetricCard label="Pending Quotes" value={String(metrics.pendingQuotes)} />
        <MetricCard label="Unpaid Invoices" value={String(metrics.unpaidInvoices)} accent="warning" />
      </View>
      <MetricCard
        label="Revenue This Month"
        value={formatCurrency(metrics.revenueThisMonth)}
        accent="success"
      />

      <View className="flex-row gap-3">
        <QuickActionButton
          label="New Estimate"
          Icon={FilePlus}
          onPress={() => router.push({ pathname: "/estimates/new", params: { mode: "estimate" } })}
        />
        <QuickActionButton
          label="New Quick Invoice"
          Icon={Zap}
          onPress={() => router.push({ pathname: "/estimates/new", params: { mode: "invoice" } })}
        />
      </View>
    </Screen>
  );
}

async function loadMetrics(): Promise<Metrics> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [pending, unpaid, revenue] = await Promise.all([
    supabase.from("estimates").select("id", { count: "exact", head: true }).in("status", ["draft", "sent"]),
    supabase
      .from("estimates")
      .select("id", { count: "exact", head: true })
      .in("status", ["invoiced", "overdue"]),
    supabase
      .from("estimates")
      .select("total_amount")
      .eq("status", "paid")
      .gte("paid_at", startOfMonth.toISOString()),
  ]);

  const revenueThisMonth = (revenue.data ?? []).reduce(
    (sum, row) => sum + Number(row.total_amount ?? 0),
    0
  );

  return {
    pendingQuotes: pending.count ?? 0,
    unpaidInvoices: unpaid.count ?? 0,
    revenueThisMonth,
  };
}
