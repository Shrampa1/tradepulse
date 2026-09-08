// Creates a Safepay "Express Checkout" hosted payment link for a deposit or
// full-balance payment, and returns its URL for the public quote page to
// redirect the customer to. Called from that page (unauthenticated customer),
// scoped by the estimate's public_token — verify_jwt is disabled for this
// function in supabase/config.toml.
//
// Reference: https://safepay-docs.netlify.app/build-your-integration/express-checkout
// Express Checkout is Safepay's hosted-redirect flow (their answer to Stripe
// Checkout — Stripe itself doesn't onboard Pakistan-based merchants). It's
// two API calls plus a locally-built redirect URL:
//   1. POST /order/payments/v3/       -> creates a payment session ("tracker")
//   2. POST /client/passport/v1/token -> a short-lived token scoping the
//      checkout to that tracker, embedded in the redirect URL as `tbt`
//   3. redirect the customer to {embedded-host}/checkout?tracker=...&tbt=...
// Steps 1 and 3 are pinned down exactly by Safepay's own docs. Step 2's exact
// request body isn't published anywhere public as of this writing — this
// sends the tracker's own `client` field (the one field their docs return
// that plausibly exists for this purpose, given the endpoint is literally
// "client/passport"). If Safepay rejects that shape, their sandbox
// dashboard's request log for this call is the fastest way to see what it
// actually expects.
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";

const SAFEPAY_SECRET_KEY = Deno.env.get("SAFEPAY_SECRET_KEY")!;
const SAFEPAY_API_KEY = Deno.env.get("SAFEPAY_API_KEY")!; // the "merchant_api_key" field
const SAFEPAY_ENV = Deno.env.get("SAFEPAY_ENV") ?? "sandbox"; // "sandbox" | "production"
const SAFEPAY_CURRENCY = Deno.env.get("SAFEPAY_CURRENCY") ?? "USD";

const API_HOST =
  SAFEPAY_ENV === "production" ? "https://api.getsafepay.com" : "https://sandbox.api.getsafepay.com";
// Safepay's embedded/checkout host differs from its API host in production
// (no "api." subdomain) per their SDK source.
const CHECKOUT_HOST =
  SAFEPAY_ENV === "production" ? "https://getsafepay.com/embedded" : "https://sandbox.api.getsafepay.com/embedded";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { token, kind } = (await req.json()) as { token: string; kind: "deposit" | "balance" };
    if (!token || (kind !== "deposit" && kind !== "balance")) {
      return json({ error: "token and kind ('deposit' | 'balance') are required." }, 422);
    }

    const admin = supabaseAdmin();
    const { data: estimate, error } = await admin
      .from("estimates")
      .select("id, deposit_amount, total_amount, status")
      .eq("public_token", token)
      .single();

    if (error || !estimate) return json({ error: "Quote not found." }, 404);

    const amount = kind === "deposit" ? Number(estimate.deposit_amount) : Number(estimate.total_amount);
    if (!(amount > 0)) return json({ error: `No ${kind} amount is due.` }, 422);

    const tracker = await createPaymentSession(amount, { estimateId: estimate.id, kind });
    const tbt = await createPassportToken(tracker.client);

    const returnUrl = `${Deno.env.get("PUBLIC_QUOTE_BASE_URL")}?token=${token}`;
    const checkoutUrl = buildCheckoutUrl({
      tracker: tracker.token,
      tbt,
      redirectUrl: `${returnUrl}&paid=1`,
      cancelUrl: returnUrl,
    });

    await admin.from("payments").insert({
      estimate_id: estimate.id,
      kind,
      amount,
      checkout_reference: tracker.token,
      status: "pending",
    });

    return json({ checkoutUrl });
  } catch (error) {
    console.error("create-deposit-session error", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

async function createPaymentSession(amount: number, metadata: Record<string, string>) {
  const response = await fetch(`${API_HOST}/order/payments/v3/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SAFEPAY_SECRET_KEY}` },
    body: JSON.stringify({
      merchant_api_key: SAFEPAY_API_KEY,
      intent: "CYBERSOURCE",
      mode: "payment",
      entry_mode: "raw",
      currency: SAFEPAY_CURRENCY,
      amount: Math.round(amount * 100), // Safepay expects the smallest currency unit
      metadata,
      include_fees: false,
    }),
  });
  if (!response.ok) throw new Error(`Safepay session create failed (${response.status}): ${await response.text()}`);

  const body = await response.json();
  const tracker = body?.data?.tracker;
  if (!tracker?.token) throw new Error("Safepay did not return a tracker token.");
  return tracker as { token: string; client: string };
}

async function createPassportToken(client: string) {
  const response = await fetch(`${API_HOST}/client/passport/v1/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SAFEPAY_SECRET_KEY}` },
    body: JSON.stringify({ client }),
  });
  if (!response.ok) throw new Error(`Safepay passport token failed (${response.status}): ${await response.text()}`);

  const body = await response.json();
  if (!body?.data) throw new Error("Safepay did not return a client token.");
  return body.data as string;
}

function buildCheckoutUrl(params: {
  tracker: string;
  tbt: string;
  redirectUrl: string;
  cancelUrl: string;
}) {
  const query = new URLSearchParams({
    tracker: params.tracker,
    tbt: params.tbt,
    environment: SAFEPAY_ENV,
    source: "hosted",
    redirect_url: params.redirectUrl,
    cancel_url: params.cancelUrl,
  });
  return `${CHECKOUT_HOST}/checkout?${query.toString()}`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
