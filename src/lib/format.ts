// The app's own display currency (profiles.currency, editable in Settings).
// Deliberately separate from SAFEPAY_CURRENCY (an edge function secret) —
// that's what Safepay actually charges, and public-quote.ts stays driven by
// it directly rather than this value, so the two must be kept in sync by
// hand if you change either (a display/charge mismatch would be a real bug).
let currentCurrency = process.env.EXPO_PUBLIC_CURRENCY ?? "USD";

export function setCurrentCurrency(code: string) {
  currentCurrency = code;
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currentCurrency,
  }).format(amount);
}

export function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  deposit_paid: "Deposit Paid",
  invoiced: "Invoiced",
  paid: "Paid",
  overdue: "Overdue",
};

export const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  draft: { bg: "bg-slate-100", text: "text-slate-600" },
  sent: { bg: "bg-blue-100", text: "text-blue-700" },
  deposit_paid: { bg: "bg-amber-100", text: "text-amber-700" },
  invoiced: { bg: "bg-indigo-100", text: "text-indigo-700" },
  paid: { bg: "bg-green-100", text: "text-green-700" },
  overdue: { bg: "bg-red-100", text: "text-red-700" },
};
