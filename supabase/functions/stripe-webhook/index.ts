// Stripe webhook: marks deposits/invoices paid once Checkout completes.
// verify_jwt is disabled for this function in supabase/config.toml since
// Stripe, not a logged-in user, calls it.
import Stripe from "npm:stripe@17";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  if (!signature) return new Response("Missing stripe-signature header", { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret, undefined, cryptoProvider);
  } catch (error) {
    console.error("Webhook signature verification failed", error);
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const estimateId = session.metadata?.estimateId;
    const kind = session.metadata?.kind as "deposit" | "balance" | undefined;

    if (estimateId && kind) {
      const admin = supabaseAdmin();
      const now = new Date().toISOString();

      await admin
        .from("payments")
        .update({ status: "succeeded", stripe_payment_intent_id: session.payment_intent as string })
        .eq("stripe_checkout_session_id", session.id);

      await admin
        .from("estimates")
        .update(
          kind === "deposit"
            ? { status: "deposit_paid", deposit_paid_at: now }
            : { status: "paid", paid_at: now }
        )
        .eq("id", estimateId);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
