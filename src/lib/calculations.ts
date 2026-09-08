import type { DraftLineItem, LineItem } from "@/types/database";

export function lineItemTotal(item: { quantity: number; unit_price: number }) {
  return round2(item.quantity * item.unit_price);
}

export function subtotal(items: Array<DraftLineItem | LineItem>) {
  return round2(items.reduce((sum, item) => sum + lineItemTotal(item), 0));
}

export function taxAmount(subtotalValue: number, taxRate: number) {
  return round2(subtotalValue * taxRate);
}

export function total(subtotalValue: number, taxAmountValue: number) {
  return round2(subtotalValue + taxAmountValue);
}

export function estimateTotals(items: Array<DraftLineItem | LineItem>, taxRate: number) {
  const sub = subtotal(items);
  const tax = taxAmount(sub, taxRate);
  return { subtotal: sub, tax, total: total(sub, tax) };
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
