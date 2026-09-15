import { createElement, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

type Props = {
  label: string;
  value: string; // "YYYY-MM-DD" for mode="date", "HH:MM" for mode="time"
  mode: "date" | "time";
  onChange: (value: string) => void;
};

// A native calendar/clock picker on iOS/Android. On web there's no
// first-party datetimepicker UI, so this renders a raw HTML <input
// type="date"/"time"> instead — react-native-web's TextInput doesn't forward
// a `type` override to its underlying DOM node, so a plain createElement is
// what actually gets the browser's own picker (confirmed: the previous
// TextInput-prop approach silently fell back to a manual text field).
export function NativePickerField({ label, value, mode, onChange }: Props) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  if (Platform.OS === "web") {
    return (
      <View className="gap-1.5">
        <Text className="text-sm font-medium text-ink">{label}</Text>
        {createElement("input", {
          type: mode,
          value,
          onChange: (e: { target: { value: string } }) => onChange(e.target.value),
          className:
            "rounded-xl border border-border bg-surface px-3.5 py-3 text-base text-ink w-full",
        })}
      </View>
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
