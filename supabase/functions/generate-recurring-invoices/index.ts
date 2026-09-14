// Feature: recurring invoicing for maintenance contracts. Meant to be invoked
// daily on a schedule (same pg_cron mechanism as check-overdue-invoices — see
// README), not by the app. For every active contract due to run, creates a
// sent estimate + line items from its template and advances next_run_at.
import { supabaseAdmin } from "../_shared/supabase-admin.ts";

const CRON_SECRET = Deno.env.get("CRON_SECRET");

type TemplateLineItem = { description: string; quantity: number; unit_price: number };

Deno.serve(async (req) => {
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = supabaseAdmin();
  const baseUrl = Deno.env.get("PUBLIC_QUOTE_BASE_URL");

  const { data: dueContracts, error } = await admin
    .from("recurring_contracts")
    .select("*")
    .eq("active", true)
    .lte("next_run_at", new Date().toISOString());

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let generated = 0;

  for (const contract of dueContracts ?? []) {
    const { data: estimate, error: insertError } = await admin
      .from("estimates")
      .insert({
        user_id: contract.user_id,
        client_id: contract.client_id,
        status: "sent",
        tax_rate: contract.tax_rate,
        deposit_amount: contract.deposit_amount,
        sent_at: new Date().toISOString(),
        notes: `Auto-generated from recurring contract: ${contract.title}`,
      })
      .select("id, public_token")
      .single();

    if (insertError || !estimate) {
      console.error("generate-recurring-invoices: failed to create estimate", insertError);
      continue;
    }

    const template = (contract.line_items_template as TemplateLineItem[]) ?? [];
    if (template.length > 0) {
      await admin.from("line_items").insert(
        template.map((item, index) => ({
          estimate_id: estimate.id,
          description: item.description || "Untitled item",
          quantity: item.quantity,
          unit_price: item.unit_price,
          sort_order: index,
        }))
      );
    }

    await admin
      .from("recurring_contracts")
      .update({ next_run_at: advance(contract.next_run_at, contract.frequency).toISOString() })
      .eq("id", contract.id);

    generated++;
    console.log(
      `generate-recurring-invoices: created estimate ${estimate.id} from contract ${contract.id}` +
        (baseUrl ? ` — ${baseUrl}?token=${estimate.public_token}` : "")
    );
  }

  return new Response(JSON.stringify({ generated }), {
    headers: { "Content-Type": "application/json" },
  });
});

function advance(fromIso: string, frequency: string): Date {
  const date = new Date(fromIso);
  if (frequency === "weekly") {
    date.setDate(date.getDate() + 7);
  } else {
    date.setMonth(date.getMonth() + 1);
  }
  return date;
}
