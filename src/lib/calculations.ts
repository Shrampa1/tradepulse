import type { DraftLineItem, LineItem } from "@/types/database";

export type Discount = { type: "fixed" | "percent"; value: number };

const NO_DISCOUNT: Discount = { type: "fixed", value: 0 };

export function lineItemTotal(item: { quantity: number; unit_price: number }) {
  return round2(item.quantity * item.unit_price);
}

export function subtotal(items: Array<DraftLineItem | LineItem>) {
  return round2(items.reduce((sum, item) => sum + lineItemTotal(item), 0));
}

// Mirrors the DB trigger in 0006_estimate_discounts.sql: a fixed discount
// never exceeds the subtotal it's applied to.
export function discountAmount(subtotalValue: number, discount: Discount) {
  if (discount.type === "percent") return round2(subtotalValue * (discount.value / 100));
  return round2(Math.min(discount.value, subtotalValue));
}

export function taxAmount(taxableValue: number, taxRate: number) {
  return round2(taxableValue * taxRate);
}

export function total(taxableValue: number, taxAmountValue: number) {
  return round2(taxableValue + taxAmountValue);
}

export function estimateTotals(
  items: Array<DraftLineItem | LineItem>,
  taxRate: number,
  discount: Discount = NO_DISCOUNT
) {
  const sub = subtotal(items);
  const discountValue = discountAmount(sub, discount);
  const taxable = round2(sub - discountValue);
  const tax = taxAmount(taxable, taxRate);
  return { subtotal: sub, discount: discountValue, tax, total: total(taxable, tax) };
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
