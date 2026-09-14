import { useCallback, useMemo, useState } from "react";
import { Pressable, SectionList, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { Screen } from "@/components/ui/Screen";
import { supabase } from "@/lib/supabase";

type AppointmentRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  clients: { name: string } | null;
};

export default function ScheduleListScreen() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsLoading(true);
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      supabase
        .from("appointments")
        .select("id, title, starts_at, ends_at, location, clients ( name )")
        .gte("starts_at", startOfToday.toISOString())
        .order("starts_at")
        .then(({ data }) => {
          if (isActive) {
            setAppointments((data as any) ?? []);
            setIsLoading(false);
          }
        });
      return () => {
        isActive = false;
      };
    }, [])
  );

  const sections = useMemo(() => groupByDay(appointments), [appointments]);

  return (
    <Screen scroll={false} className="pt-4">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-ink">Schedule</Text>
        <Pressable
          onPress={() => router.push("/appointments/new")}
          className="h-10 w-10 items-center justify-center rounded-full bg-brand-600"
        >
          <Plus color="#fff" size={20} />
        </Pressable>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerClassName="gap-2 pb-10"
        refreshing={isLoading}
        ListEmptyComponent={
          !isLoading ? (
            <Text className="mt-10 text-center text-sm text-subtle">
              Nothing scheduled. Tap + to add a job.
            </Text>
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <Text className="bg-muted py-2 text-sm font-semibold text-ink">{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <View className="gap-1 rounded-2xl border border-border bg-surface p-4">
            <View className="flex-row items-center justify-between">
              <Text className="flex-1 text-base font-semibold text-ink">{item.title}</Text>
              <Text className="text-sm font-medium text-brand-600">{formatTimeRange(item)}</Text>
            </View>
            {(item.clients?.name || item.location) && (
              <Text className="text-sm text-subtle">
                {[item.clients?.name, item.location].filter(Boolean).join(" · ")}
              </Text>
            )}
          </View>
        )}
      />
    </Screen>
  );
}

function formatTimeRange(item: AppointmentRow) {
  const start = new Date(item.starts_at).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  if (!item.ends_at) return start;
  const end = new Date(item.ends_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${start} – ${end}`;
}

function groupByDay(appointments: AppointmentRow[]) {
  const groups = new Map<string, { title: string; data: AppointmentRow[] }>();

  for (const appointment of appointments) {
    const date = new Date(appointment.starts_at);
    const key = date.toDateString();
    const title = date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
    if (!groups.has(key)) groups.set(key, { title, data: [] });
    groups.get(key)!.data.push(appointment);
  }

  return Array.from(groups.values());
}
