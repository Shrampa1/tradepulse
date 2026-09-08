// Feature E: automated follow-up "trigger" for unpaid bills. Meant to be
// invoked on a schedule (e.g. Supabase's pg_cron, once a day — see README)
// rather than by the app. It flips any invoice past its due date to
// 'overdue' and logs a reminder row per client; wiring that log up to a real
// email/SMS send is a drop-in follow-up, not a schema change.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";

const CRON_SECRET = Deno.env.get("CRON_SECRET");

Deno.serve(async (req) => {
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = supabaseAdmin();

  const { data: overdue, error } = await admin
    .from("estimates")
    .select("id, due_at, clients ( name, email, phone )")
    .eq("status", "invoiced")
    .lt("due_at", new Date().toISOString());

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  for (const estimate of overdue ?? []) {
    await admin.from("estimates").update({ status: "overdue" }).eq("id", estimate.id);

    const client = (estimate as any).clients;
    await admin.from("reminders").insert({
      estimate_id: estimate.id,
      channel: "simulated",
      message: `Follow-up would be sent to ${client?.name ?? "client"} (${
        client?.email ?? client?.phone ?? "no contact on file"
      }): invoice overdue since ${estimate.due_at}.`,
    });
  }

  return new Response(JSON.stringify({ markedOverdue: overdue?.length ?? 0 }), {
    headers: { "Content-Type": "application/json" },
  });
});
