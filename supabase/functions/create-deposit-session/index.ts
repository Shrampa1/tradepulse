// Creates a Stripe Checkout Session for a deposit or full-balance payment.
// Called from the public quote page (unauthenticated customer), scoped by
// the estimate's public_token rather than a user session — verify_jwt is
// disabled for this function in supabase/config.toml.
import Stripe from "npm:stripe@17";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });

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
      .select("id, deposit_amount, total_amount, status, clients ( name, email )")
      .eq("public_token", token)
      .single();

    if (error || !estimate) return json({ error: "Quote not found." }, 404);

    const amount = kind === "deposit" ? Number(estimate.deposit_amount) : Number(estimate.total_amount);
    if (!(amount > 0)) return json({ error: `No ${kind} amount is due.` }, 422);

    const baseUrl = Deno.env.get("PUBLIC_QUOTE_BASE_URL")!;
    const returnUrl = `${baseUrl}?token=${token}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: (estimate as any).clients?.email ?? undefined,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: Math.round(amount * 100),
            product_data: { name: kind === "deposit" ? "Deposit" : "Balance due" },
          },
          quantity: 1,
        },
      ],
      metadata: { estimateId: estimate.id, kind },
      success_url: `${returnUrl}&paid=1`,
      cancel_url: returnUrl,
    });

    await admin.from("payments").insert({
      estimate_id: estimate.id,
      kind,
      amount,
      stripe_checkout_session_id: session.id,
      status: "pending",
    });

    return json({ checkoutUrl: session.url });
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
