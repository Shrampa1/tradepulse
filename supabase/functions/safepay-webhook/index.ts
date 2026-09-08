// Safepay webhook: marks deposits/invoices paid once their hosted checkout
// completes. verify_jwt is disabled for this function in supabase/config.toml
// since Safepay, not a logged-in user, calls it.
//
// Reference: https://safepay-docs.netlify.app/developers/webhooks/verify-hmac-signatures
// Signature: header `X-SFPY-SIGNATURE`, HMAC-SHA512 hex digest of the raw
// request body, keyed with the endpoint's "shared secret" from Safepay's
// Dashboard -> Developers -> Endpoints (a different value from SAFEPAY_SECRET_KEY).
import { supabaseAdmin } from "../_shared/supabase-admin.ts";

const WEBHOOK_SECRET = Deno.env.get("SAFEPAY_WEBHOOK_SECRET")!;

Deno.serve(async (req) => {
  const signature = req.headers.get("x-sfpy-signature");
  const rawBody = await req.text();

  if (!signature) return new Response("Missing X-SFPY-SIGNATURE header", { status: 400 });

  const expected = await hmacSha512Hex(WEBHOOK_SECRET, rawBody);
  if (!timingSafeEqual(expected, signature)) {
    console.error("Safepay webhook signature mismatch");
    return new Response("Invalid signature", { status: 400 });
  }

  const event = JSON.parse(rawBody);

  // https://safepay-docs.netlify.app/developers/webhooks/webhook-types
  if (event.type === "payment.succeeded") {
    const metadata = event.data?.metadata ?? {};
    const estimateId = metadata.estimateId;
    const kind = metadata.kind as "deposit" | "balance" | undefined;
    const trackerToken = event.data?.tracker as string | undefined;

    if (estimateId && kind) {
      const admin = supabaseAdmin();
      const now = new Date().toISOString();

      if (trackerToken) {
        await admin
          .from("payments")
          .update({ status: "succeeded", provider_payment_id: event.token ?? null })
          .eq("checkout_reference", trackerToken);
      }

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

async function hmacSha512Hex(secret: string, data: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
