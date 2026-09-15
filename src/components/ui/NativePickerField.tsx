import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Input } from "@/components/ui/Input";

type Props = {
  label: string;
  value: string; // "YYYY-MM-DD" for mode="date", "HH:MM" for mode="time"
  mode: "date" | "time";
  onChange: (value: string) => void;
};

// A native calendar/clock picker on iOS/Android. On web there's no first-party
// datetimepicker UI, so this falls back to the plain text Input — react-native-web
// forwards an unrecognized `type` prop straight to the underlying <input>, which
// gets the browser's own date/time picker for free when that happens to work,
// and degrades to a harmless plain text field when it doesn't.
export function NativePickerField({ label, value, mode, onChange }: Props) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  if (Platform.OS === "web") {
    return (
      <Input
        label={label}
        value={value}
        onChangeText={onChange}
        placeholder={mode === "date" ? "YYYY-MM-DD" : "HH:MM"}
        {...({ type: mode } as object)}
      />
    );
  }

  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-ink">{label}</Text>
      <Pressable
        onPress={() => setIsPickerOpen(true)}
        className="rounded-xl border border-border px-3.5 py-3"
      >
        <Text className={value ? "text-base text-ink" : "text-base text-subtle"}>
          {value || (mode === "date" ? "Select a date" : "Select a time")}
        </Text>
      </Pressable>
      {isPickerOpen && (
        <DateTimePicker
          value={toDate(value, mode)}
          mode={mode}
          display="default"
          onChange={(_event, selected) => {
            setIsPickerOpen(false);
            if (selected) onChange(mode === "date" ? formatDate(selected) : formatTime(selected));
          }}
        />
      )}
    </View>
  );
}

function toDate(value: string, mode: "date" | "time"): Date {
  if (mode === "date") {
    const [year, month, day] = value.split("-").map(Number);
    return year && month && day ? new Date(year, month - 1, day) : new Date();
  }
  const [hours, minutes] = value.split(":").map(Number);
  const base = new Date();
  if (!Number.isNaN(hours) && !Number.isNaN(minutes)) base.setHours(hours, minutes, 0, 0);
  return base;
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
