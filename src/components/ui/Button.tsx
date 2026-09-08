import { ActivityIndicator, Pressable, Text, type PressableProps } from "react-native";

type Variant = "primary" | "secondary" | "ghost" | "destructive";

const VARIANT_STYLES: Record<Variant, { container: string; label: string }> = {
  primary: { container: "bg-brand-600 active:bg-brand-700", label: "text-white" },
  secondary: { container: "bg-muted active:bg-border", label: "text-ink" },
  ghost: { container: "bg-transparent active:bg-muted", label: "text-brand-600" },
  destructive: { container: "bg-danger active:bg-red-700", label: "text-white" },
};

type ButtonProps = PressableProps & {
  label: string;
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
};

export function Button({
  label,
  variant = "primary",
  loading,
  fullWidth,
  disabled,
  className,
  ...props
}: ButtonProps) {
  const styles = VARIANT_STYLES[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      className={`flex-row items-center justify-center rounded-xl px-4 py-3.5 ${styles.container} ${
        fullWidth ? "w-full" : ""
      } ${isDisabled ? "opacity-50" : ""} ${className ?? ""}`}
      {...props}
    >
      {loading && <ActivityIndicator className="mr-2" color={variant === "primary" ? "#fff" : "#2563eb"} />}
      <Text className={`text-base font-semibold ${styles.label}`}>{label}</Text>
    </Pressable>
  );
}
