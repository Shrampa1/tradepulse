// Creates a Safepay hosted checkout link for a deposit or full-balance
// payment, and returns its URL for the public quote page to redirect the
// customer to. Called from that page (unauthenticated customer), scoped by
// the estimate's public_token — verify_jwt is disabled for this function in
// supabase/config.toml.
//
// Ported from the sibling YDEL project's checkout flow (src/lib/safepay.ts,
// src/app/customer/checkout/actions.ts), which verified this against a real
// sandbox rather than relying on Safepay's general docs.
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { buildCheckoutUrl, createPaymentTracker, type SafepayCurrency } from "../_shared/safepay.ts";

const CURRENCY = (Deno.env.get("SAFEPAY_CURRENCY") as SafepayCurrency) || "PKR";

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

    const tracker = await createPaymentTracker({ amount, currency: CURRENCY });

    // No metadata field on Safepay's tracker — correlate back to the
    // estimate/kind via our own `payments` row instead (see safepay-webhook
    // and public-quote, which look this up by checkout_reference).
    await admin.from("payments").insert({
      estimate_id: estimate.id,
      kind,
      amount,
      checkout_reference: tracker.token,
      status: "pending",
    });

    // No query string here — Safepay appends its own `?order_id=...&tracker=...`
    // to redirect_url with a literal `?`, so an existing one would double up.
    // Its order_id echoes back what we pass below, so the public-quote page
    // reads `order_id` (aliased to `token`) off the return request instead.
    const baseUrl = Deno.env.get("PUBLIC_QUOTE_BASE_URL")!;
    const checkoutUrl = buildCheckoutUrl({
      token: tracker.token,
      orderId: token,
      cancelUrl: `${baseUrl}?token=${token}`,
      redirectUrl: baseUrl,
    });

    return json({ checkoutUrl });
  } catch (error) {
    console.error("create-deposit-session error", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
