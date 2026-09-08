// Marks an estimate as sent and returns the public link the tradesperson
// shares with their client (text, email, etc).
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { getUserId, supabaseAdmin } from "../_shared/supabase-admin.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const userId = await getUserId(req);
  if (!userId) return json({ error: "Unauthorized" }, 401);

  const { estimateId } = await req.json();
  if (!estimateId) return json({ error: "estimateId is required." }, 422);

  const admin = supabaseAdmin();

  // Ownership check: only the tradesperson who created this estimate may send it.
  const { data: estimate, error: fetchError } = await admin
    .from("estimates")
    .select("id, user_id, public_token, status")
    .eq("id", estimateId)
    .single();

  if (fetchError || !estimate) return json({ error: "Estimate not found." }, 404);
  if (estimate.user_id !== userId) return json({ error: "Forbidden" }, 403);

  const { error: updateError } = await admin
    .from("estimates")
    .update({ status: estimate.status === "draft" ? "sent" : estimate.status, sent_at: new Date().toISOString() })
    .eq("id", estimateId);

  if (updateError) return json({ error: updateError.message }, 500);

  const baseUrl = Deno.env.get("PUBLIC_QUOTE_BASE_URL")!;
  const publicUrl = `${baseUrl}?token=${estimate.public_token}`;

  return json({ publicUrl });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
