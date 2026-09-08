// Safepay webhook: marks deposits/invoices paid once their hosted checkout
// completes. verify_jwt is disabled for this function in supabase/config.toml
// since Safepay, not a logged-in user, calls it.
//
// The HMAC-SHA512-over-`data`-field scheme here is ported from the sibling
// YDEL project (src/lib/safepay.ts), which verified it empirically. The
// payload field names (token/state) are YDEL's best guess at the shape,
// flagged in its own comments as NOT yet exercised against a real webhook
// delivery — treat a mismatch here as the first thing to check if payments
// succeed in the sandbox but this function never fires. public-quote's
// return-page fallback (a direct tracker status check) covers that gap in
// the meantime, same as YDEL's checkout return page does.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import {
  verifyWebhookSignature,
  SUCCESS_PATTERN,
  FAILURE_PATTERN,
  markPaymentSucceeded,
} from "../_shared/safepay.ts";

Deno.serve(async (req) => {
  const body = await req.json();
  const signature = req.headers.get("x-sfpy-signature");

  if (!(await verifyWebhookSignature(body.data, signature))) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const trackerToken: string | undefined = body.data?.token;
  const state: string | undefined = body.data?.state;

  if (trackerToken && state) {
    const admin = supabaseAdmin();
    const { data: payment } = await admin
      .from("payments")
      .select("id, estimate_id, kind, status")
      .eq("checkout_reference", trackerToken)
      .maybeSingle();

    if (payment && payment.status === "pending") {
      if (SUCCESS_PATTERN.test(state)) {
        await markPaymentSucceeded(admin, payment);
      } else if (FAILURE_PATTERN.test(state)) {
        await admin.from("payments").update({ status: "failed" }).eq("id", payment.id);
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
