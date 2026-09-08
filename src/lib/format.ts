// Must match SAFEPAY_CURRENCY (an edge function secret, so it can't be read
// directly from here) — the app only displays amounts, Safepay is what
// actually charges them, so keep the two in sync by hand if you change either.
const CURRENCY = process.env.EXPO_PUBLIC_CURRENCY ?? "PKR";

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: CURRENCY,
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
