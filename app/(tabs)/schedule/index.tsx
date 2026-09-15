import { useCallback, useMemo, useState } from "react";
import { FlatList, Modal, Pressable, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Mic, Plus } from "lucide-react-native";
import { Screen } from "@/components/ui/Screen";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { NativePickerField } from "@/components/ui/NativePickerField";
import { CalendarMonthView, dateKey } from "@/components/schedule/CalendarMonthView";
import { VoiceScheduleCapture } from "@/components/schedule/VoiceScheduleCapture";
import { combineDateAndTime } from "@/components/schedule/AppointmentForm";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/format";

type ParsedAppointment = { title: string; date: string; time: string; location: string | null };

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
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [pendingAppointment, setPendingAppointment] = useState<ParsedAppointment | null>(null);

  const reload = useCallback(() => {
    setIsLoading(true);
    // Load a little beyond the visible month so the leading/trailing days
    // shown in the calendar grid still get their "has appointments" dot.
    const rangeStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
    const rangeEnd = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 2, 1);

    return supabase
      .from("appointments")
      .select("id, title, starts_at, ends_at, location, clients ( name ), estimates ( id, total_amount )")
      .gte("starts_at", rangeStart.toISOString())
      .lt("starts_at", rangeEnd.toISOString())
      .order("starts_at")
      .then(({ data }) => {
        setMonthAppointments((data as any) ?? []);
        setIsLoading(false);
      });
  }, [visibleMonth]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  async function handleConfirmVoiceAppointment() {
    if (!pendingAppointment) return;
    const startsAt = combineDateAndTime(pendingAppointment.date, pendingAppointment.time);
    if (!startsAt) return;

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    await supabase.from("appointments").insert({
      user_id: userData.user.id,
      title: pendingAppointment.title,
      starts_at: startsAt.toISOString(),
      location: pendingAppointment.location,
    });
    setPendingAppointment(null);
    setIsVoiceOpen(false);
    reload();
  }

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
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => setIsVoiceOpen((open) => !open)}
            className={`h-9 w-9 items-center justify-center rounded-full ${
              isVoiceOpen ? "bg-brand-700" : "bg-brand-600"
            }`}
          >
            <Mic color="#fff" size={16} />
          </Pressable>
          <Pressable
            onPress={() =>
              router.push({ pathname: "/appointments/new", params: { date: dateKey(selectedDate) } })
            }
            className="h-9 w-9 items-center justify-center rounded-full bg-brand-600"
          >
            <Plus color="#fff" size={18} />
          </Pressable>
        </View>
      </View>

      {isVoiceOpen && <VoiceScheduleCapture onParsed={setPendingAppointment} />}

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

      <Modal
        visible={pendingAppointment !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setPendingAppointment(null)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="gap-3 rounded-t-3xl bg-muted p-4 pb-8">
            <Text className="text-lg font-bold text-ink">Confirm job</Text>
            {pendingAppointment && (
              <Card className="gap-3">
                <Input
                  label="Title"
                  value={pendingAppointment.title}
                  onChangeText={(text) =>
                    setPendingAppointment((current) => (current ? { ...current, title: text } : current))
                  }
                />
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <NativePickerField
                      label="Date"
                      mode="date"
                      value={pendingAppointment.date}
                      onChange={(value) =>
                        setPendingAppointment((current) => (current ? { ...current, date: value } : current))
                      }
                    />
                  </View>
                  <View className="flex-1">
                    <NativePickerField
                      label="Time"
                      mode="time"
                      value={pendingAppointment.time}
                      onChange={(value) =>
                        setPendingAppointment((current) => (current ? { ...current, time: value } : current))
                      }
                    />
                  </View>
                </View>
              </Card>
            )}
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button label="Cancel" variant="secondary" onPress={() => setPendingAppointment(null)} />
              </View>
              <View className="flex-1">
                <Button label="Confirm" onPress={handleConfirmVoiceAppointment} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
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
