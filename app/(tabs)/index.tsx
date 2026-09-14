import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { CalendarDays, FilePlus, Zap } from "lucide-react-native";
import { Screen } from "@/components/ui/Screen";
import { Card } from "@/components/ui/Card";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { QuickActionButton } from "@/components/dashboard/QuickActionButton";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/format";

type Metrics = {
  pendingQuotes: number;
  unpaidInvoices: number;
  revenueThisMonth: number;
  profitThisMonth: number;
};

type TodayJob = {
  id: string;
  title: string;
  starts_at: string;
};

export default function DashboardScreen() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<Metrics>({
    pendingQuotes: 0,
    unpaidInvoices: 0,
    revenueThisMonth: 0,
    profitThisMonth: 0,
  });
  const [todayJobs, setTodayJobs] = useState<TodayJob[]>([]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      loadMetrics().then((next) => {
        if (isActive) setMetrics(next);
      });
      loadTodayJobs().then((next) => {
        if (isActive) setTodayJobs(next);
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
      <View className="flex-row gap-3">
        <MetricCard
          label="Revenue This Month"
          value={formatCurrency(metrics.revenueThisMonth)}
          accent="success"
        />
        <MetricCard
          label="Profit This Month"
          value={formatCurrency(metrics.profitThisMonth)}
          accent={metrics.profitThisMonth >= 0 ? "success" : "warning"}
        />
      </View>

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

      <Pressable onPress={() => router.push("/(tabs)/schedule")}>
        <Card className="gap-2">
          <View className="flex-row items-center gap-2">
            <CalendarDays color="#2563eb" size={18} />
            <Text className="text-sm font-semibold text-ink">Today's jobs</Text>
          </View>
          {todayJobs.length === 0 ? (
            <Text className="text-sm text-subtle">Nothing scheduled today.</Text>
          ) : (
            todayJobs.map((job) => (
              <Text key={job.id} className="text-sm text-subtle">
                {new Date(job.starts_at).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}{" "}
                — {job.title}
              </Text>
            ))
          )}
        </Card>
      </Pressable>
    </Screen>
  );
}

async function loadMetrics(): Promise<Metrics> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [pending, unpaid, revenue, expenses] = await Promise.all([
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
    supabase.from("expenses").select("amount").gte("occurred_at", startOfMonth.toISOString()),
  ]);

  const revenueThisMonth = (revenue.data ?? []).reduce(
    (sum, row) => sum + Number(row.total_amount ?? 0),
    0
  );
  const expensesThisMonth = (expenses.data ?? []).reduce(
    (sum, row) => sum + Number(row.amount ?? 0),
    0
  );

  return {
    pendingQuotes: pending.count ?? 0,
    unpaidInvoices: unpaid.count ?? 0,
    revenueThisMonth,
    profitThisMonth: revenueThisMonth - expensesThisMonth,
  };
}

async function loadTodayJobs(): Promise<TodayJob[]> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const { data } = await supabase
    .from("appointments")
    .select("id, title, starts_at")
    .gte("starts_at", startOfToday.toISOString())
    .lt("starts_at", startOfTomorrow.toISOString())
    .order("starts_at");

  return data ?? [];
}
