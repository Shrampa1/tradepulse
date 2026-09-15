import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { Screen } from "@/components/ui/Screen";
import { CalendarMonthView, dateKey } from "@/components/schedule/CalendarMonthView";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/format";

type AppointmentRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  clients: { name: string } | null;
  estimates: { id: string; total_amount: number } | null;
};

export default function ScheduleListScreen() {
  const router = useRouter();
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [monthAppointments, setMonthAppointments] = useState<AppointmentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsLoading(true);
      // Load a little beyond the visible month so the leading/trailing days
      // shown in the calendar grid still get their "has appointments" dot.
      const rangeStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
      const rangeEnd = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 2, 1);

      supabase
        .from("appointments")
        .select("id, title, starts_at, ends_at, location, clients ( name ), estimates ( id, total_amount )")
        .gte("starts_at", rangeStart.toISOString())
        .lt("starts_at", rangeEnd.toISOString())
        .order("starts_at")
        .then(({ data }) => {
          if (isActive) {
            setMonthAppointments((data as any) ?? []);
            setIsLoading(false);
          }
        });
      return () => {
        isActive = false;
      };
    }, [visibleMonth])
  );

  const markedDateKeys = useMemo(
    () => new Set(monthAppointments.map((appointment) => dateKey(new Date(appointment.starts_at)))),
    [monthAppointments]
  );

  const dayAppointments = useMemo(() => {
    const selectedKey = dateKey(selectedDate);
    return monthAppointments.filter(
      (appointment) => dateKey(new Date(appointment.starts_at)) === selectedKey
    );
  }, [monthAppointments, selectedDate]);

  function changeMonth(delta: 1 | -1) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  return (
    <Screen>
      <Text className="mt-2 text-2xl font-bold text-ink">Schedule</Text>

      <CalendarMonthView
        visibleMonth={visibleMonth}
        selectedDate={selectedDate}
        markedDateKeys={markedDateKeys}
        onSelectDate={setSelectedDate}
        onChangeMonth={changeMonth}
      />

      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-ink">
          {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
        </Text>
        <Pressable
          onPress={() =>
            router.push({ pathname: "/appointments/new", params: { date: dateKey(selectedDate) } })
          }
          className="h-9 w-9 items-center justify-center rounded-full bg-brand-600"
        >
          <Plus color="#fff" size={18} />
        </Pressable>
      </View>

      <FlatList
        data={dayAppointments}
        scrollEnabled={false}
        keyExtractor={(item) => item.id}
        contentContainerClassName="gap-2 pb-10"
        ListEmptyComponent={
          !isLoading ? (
            <Text className="py-6 text-center text-sm text-subtle">
              Nothing scheduled. Tap + to add a job.
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/appointments/${item.id}`)}
            className="gap-1 rounded-2xl border border-border bg-surface p-4"
          >
            <View className="flex-row items-center justify-between">
              <Text className="flex-1 text-base font-semibold text-ink">{item.title}</Text>
              <Text className="text-sm font-medium text-brand-600">{formatTimeRange(item)}</Text>
            </View>
            {(item.clients?.name || item.location) && (
              <Text className="text-sm text-subtle">
                {[item.clients?.name, item.location].filter(Boolean).join(" · ")}
              </Text>
            )}
            {item.estimates && (
              <Text className="text-xs text-brand-600">
                Linked estimate · {formatCurrency(item.estimates.total_amount)}
              </Text>
            )}
          </Pressable>
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
