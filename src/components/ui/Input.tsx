import { Text, TextInput, View, type TextInputProps } from "react-native";

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
};

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <View className="gap-1.5">
      {label && <Text className="text-sm font-medium text-ink">{label}</Text>}
      <TextInput
        placeholderTextColor="#94a3b8"
        className={`rounded-xl border px-3.5 py-3 text-base text-ink ${
          error ? "border-danger" : "border-border"
        } ${className ?? ""}`}
        {...props}
      />
      {error && <Text className="text-xs text-danger">{error}</Text>}
    </View>
  );
}
