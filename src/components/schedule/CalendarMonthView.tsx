import { Pressable, Text, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

type Props = {
  visibleMonth: Date;
  selectedDate: Date;
  markedDateKeys: Set<string>;
  onSelectDate: (date: Date) => void;
  onChangeMonth: (delta: 1 | -1) => void;
};

export function CalendarMonthView({
  visibleMonth,
  selectedDate,
  markedDateKeys,
  onSelectDate,
  onChangeMonth,
}: Props) {
  const days = buildMonthGrid(visibleMonth);
  const today = new Date();

  return (
    <View className="gap-3 rounded-2xl border border-border bg-surface p-4">
      <View className="flex-row items-center justify-between">
        <Pressable onPress={() => onChangeMonth(-1)} hitSlop={8} className="p-1">
          <ChevronLeft size={20} color="#0f172a" />
        </Pressable>
        <Text className="text-base font-semibold text-ink">
          {visibleMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </Text>
        <Pressable onPress={() => onChangeMonth(1)} hitSlop={8} className="p-1">
          <ChevronRight size={20} color="#0f172a" />
        </Pressable>
      </View>

      <View className="flex-row">
        {WEEKDAY_LABELS.map((label, index) => (
          <Text key={index} className="w-[14.28%] text-center text-xs font-medium text-subtle">
            {label}
          </Text>
        ))}
      </View>

      <View className="flex-row flex-wrap">
        {days.map((day, index) => {
          const inMonth = day.getMonth() === visibleMonth.getMonth();
          const isSelected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, today);
          const isMarked = markedDateKeys.has(dateKey(day));

          return (
            <Pressable
              key={index}
              onPress={() => onSelectDate(day)}
              className="w-[14.28%] items-center py-1.5"
            >
              <View
                className={`h-8 w-8 items-center justify-center rounded-full ${
                  isSelected ? "bg-brand-600" : isToday ? "border border-brand-600" : ""
                }`}
              >
                <Text
                  className={
                    isSelected
                      ? "text-sm font-semibold text-white"
                      : inMonth
                        ? "text-sm text-ink"
                        : "text-sm text-subtle opacity-40"
                  }
                >
                  {day.getDate()}
                </Text>
              </View>
              <View
                className={`mt-0.5 h-1 w-1 rounded-full ${isMarked ? "bg-brand-600" : "bg-transparent"}`}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function buildMonthGrid(visibleMonth: Date): Date[] {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - firstOfMonth.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
