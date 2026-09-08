// Safepay client, ported from the sibling YDEL project's src/lib/safepay.ts,
// which verified these endpoints/shapes empirically against the sandbox API
// (not from Safepay's general docs, which disagree with reality on at least
// one point — see the amount-units note below). Implemented directly against
// the REST API rather than the @sfpy/node-sdk package.
//
// IMPORTANT (verified empirically, contradicts Safepay's docs which claim
// amounts are in "minor units"): for PKR, `amount` is in WHOLE RUPEES, not
// paisa. TradePulse's own amounts (estimates.total_amount etc.) are already
// plain decimal currency, so this needs a plain round(), not a ×100. Whether
// this same whole-unit behavior holds for USD or other currencies has NOT
// been verified — test a small real sandbox payment before trusting it if
// you set SAFEPAY_CURRENCY to anything other than PKR.
//
// NO REFUND FUNCTION HERE (intentionally, matching YDEL) — no confirmed
// self-serve refund API exists; refunds are processed from the Safepay
// dashboard.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const ENVIRONMENT = Deno.env.get("SAFEPAY_ENVIRONMENT") || "sandbox";
const API_KEY = Deno.env.get("SAFEPAY_API_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("SAFEPAY_WEBHOOK_SECRET");

const API_URL =
  ENVIRONMENT === "production"
    ? "https://api.getsafepay.com"
    : ENVIRONMENT === "development"
      ? "https://dev.api.getsafepay.com"
      : "https://sandbox.api.getsafepay.com";

const CHECKOUT_URL =
  ENVIRONMENT === "production"
    ? "https://getsafepay.com/checkout"
    : ENVIRONMENT === "development"
      ? "https://dev.api.getsafepay.com/checkout"
      : "https://sandbox.api.getsafepay.com/checkout";

export type SafepayCurrency = "PKR" | "USD";

export interface Tracker {
  token: string;
  state: string;
  amount: number;
  currency: string;
}

/** Creates a payment tracker and returns its token, used to build the checkout URL. */
export async function createPaymentTracker({
  amount,
  currency = "PKR",
}: {
  amount: number; // whole currency units, e.g. 150.00 PKR, not cents
  currency?: SafepayCurrency;
}): Promise<Tracker> {
  const res = await fetch(`${API_URL}/order/v1/init`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      amount: Math.round(amount),
      client: API_KEY,
      currency,
      environment: ENVIRONMENT,
    }),
  });

  if (!res.ok) {
    throw new Error(`Safepay tracker creation failed: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  return json.data as Tracker;
}

/** Fetches the current state of a tracker — used as a fallback on the return
 *  page in case the webhook hasn't (yet) landed. */
export async function getTracker(token: string): Promise<Tracker> {
  const res = await fetch(`${API_URL}/order/v1/${token}`);

  if (!res.ok) {
    throw new Error(`Safepay tracker lookup failed: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  return json.data as Tracker;
}

/** Builds the hosted checkout page URL for a tracker (no network call).
 *
 * `redirectUrl` must NOT contain a `?` — Safepay appends its own
 * `?order_id=...&tracker=...` (echoing back the `orderId` passed here) with a
 * literal `?`, not `&`, so an existing query string produces a malformed
 * double-`?` URL. */
export function buildCheckoutUrl({
  token,
  orderId,
  cancelUrl,
  redirectUrl,
}: {
  token: string;
  orderId: string;
  cancelUrl: string;
  redirectUrl: string;
}): string {
  const params = new URLSearchParams({
    beacon: token,
    cancel_url: cancelUrl,
    env: ENVIRONMENT,
    order_id: orderId,
    redirect_url: redirectUrl,
    source: "custom",
    webhooks: "true",
  });

  return `${CHECKOUT_URL}/pay?${params.toString()}`;
}

export const SUCCESS_PATTERN = /ENDED|SUCCESS|COMPLETE|AUTHORIZED|CAPTURED/i;
export const FAILURE_PATTERN = /FAIL|DECLINE|ABANDON|CANCEL|ERROR/i;

// Shared by safepay-webhook (on a real webhook delivery) and public-quote (as
// a fallback status check when the customer returns from checkout) so the
// "mark this payment/estimate paid" logic exists in exactly one place.
export async function markPaymentSucceeded(
  admin: SupabaseClient,
  payment: { id: string; estimate_id: string; kind: string }
) {
  const now = new Date().toISOString();
  await admin.from("payments").update({ status: "succeeded" }).eq("id", payment.id);
  await admin
    .from("estimates")
    .update(
      payment.kind === "deposit"
        ? { status: "deposit_paid", deposit_paid_at: now }
        : { status: "paid", paid_at: now }
    )
    .eq("id", payment.estimate_id);
}

/** Verifies the `x-sfpy-signature` header on an incoming webhook request body. */
export async function verifyWebhookSignature(
  dataField: unknown,
  signatureHeader: string | null
): Promise<boolean> {
  if (!WEBHOOK_SECRET || !signatureHeader) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(JSON.stringify(dataField))
  );
  const expected = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (expected.length !== signatureHeader.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  return mismatch === 0;
}
