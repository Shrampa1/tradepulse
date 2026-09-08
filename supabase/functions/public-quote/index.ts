// The one part of TradePulse that has to be a plain web page: the customer
// who receives a quote/invoice doesn't have the Expo app installed, so this
// serves a small, dependency-light HTML page from the public_token in the
// link. GET renders it; POST persists a signature. Payment itself happens by
// redirecting to Safepay's hosted checkout (see create-deposit-session).
// verify_jwt is disabled for this function in supabase/config.toml.
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";

const FUNCTIONS_BASE_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return html("Missing quote link.", 400);

  const admin = supabaseAdmin();

  if (req.method === "POST") {
    const { signatureDataUrl } = await req.json();
    const { error } = await admin
      .from("estimates")
      .update({ signature_data_url: signatureDataUrl, signed_at: new Date().toISOString() })
      .eq("public_token", token);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  const { data: estimate, error } = await admin
    .from("estimates")
    .select("*, clients ( name, address ), line_items ( * )")
    .eq("public_token", token)
    .single();

  if (error || !estimate) return html("This quote could not be found.", 404);

  const { data: profile } = await admin
    .from("profiles")
    .select("business_name, phone")
    .eq("user_id", estimate.user_id)
    .single();

  const paidBanner = url.searchParams.get("paid") === "1";

  return html(renderPage(estimate, profile, token, paidBanner));
});

function renderPage(estimate: any, profile: any, token: string, paidBanner: boolean) {
  const lineItems = (estimate.line_items ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order);
  const showDepositButton = estimate.deposit_amount > 0 && estimate.status === "sent";
  const showBalanceButton = ["invoiced", "overdue"].includes(estimate.status);
  const isSigned = Boolean(estimate.signed_at);
  const money = (n: number) => `$${Number(n).toFixed(2)}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(profile?.business_name || "Quote")} — Quote</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f1f5f9; color: #0f172a; }
  .wrap { max-width: 480px; margin: 0 auto; padding: 20px 16px 48px; }
  h1 { font-size: 20px; margin: 4px 0 0; }
  .muted { color: #64748b; font-size: 13px; }
  .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px; margin-top: 16px; }
  .badge { display: inline-block; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 999px; background: #dbeafe; color: #1d4ed8; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  td { padding: 8px 0; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  td.num { text-align: right; white-space: nowrap; }
  .totals td { border: none; padding: 4px 0; }
  .totals .grand td { font-weight: 700; font-size: 16px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  button.pay { width: 100%; padding: 14px; margin-top: 12px; border: none; border-radius: 12px; background: #2563eb; color: #fff; font-size: 16px; font-weight: 600; }
  button.pay:disabled { opacity: .5; }
  canvas#sig { width: 100%; height: 140px; border: 1px dashed #cbd5e1; border-radius: 12px; touch-action: none; background: #fff; }
  .row { display: flex; gap: 8px; margin-top: 8px; }
  .row button { flex: 1; padding: 10px; border-radius: 10px; border: 1px solid #e2e8f0; background: #f8fafc; font-size: 13px; }
  .banner { background: #dcfce7; color: #166534; padding: 10px 14px; border-radius: 10px; font-size: 14px; margin-bottom: 12px; }
</style>
</head>
<body>
<div class="wrap">
  ${paidBanner ? '<div class="banner">Payment received — thank you!</div>' : ""}
  <div class="muted">${escapeHtml(profile?.business_name || "")}</div>
  <h1>Quote for ${escapeHtml(estimate.clients?.name || "you")}</h1>
  <span class="badge">${escapeHtml(statusLabel(estimate.status))}</span>

  <div class="card">
    <table>
      <tbody>
        ${lineItems
          .map(
            (item: any) => `<tr>
          <td>${escapeHtml(item.description)}<div class="muted">${Number(item.quantity)} × ${money(item.unit_price)}</div></td>
          <td class="num">${money(item.total)}</td>
        </tr>`
          )
          .join("")}
      </tbody>
    </table>
    <table class="totals">
      <tr><td class="muted">Subtotal</td><td class="num">${money(estimate.subtotal_amount)}</td></tr>
      <tr><td class="muted">Tax</td><td class="num">${money(estimate.tax_amount)}</td></tr>
      <tr class="grand"><td>Total</td><td class="num">${money(estimate.total_amount)}</td></tr>
    </table>
  </div>

  <div class="card">
    <div class="muted" style="margin-bottom:8px;">Sign to approve this ${estimate.deposit_amount > 0 ? "quote" : "invoice"}</div>
    ${
      isSigned
        ? '<div class="banner">Signed ✓</div>'
        : `<canvas id="sig" width="600" height="280"></canvas>
    <div class="row">
      <button id="clear">Clear</button>
      <button id="save">Save signature</button>
    </div>`
    }
  </div>

  ${
    showDepositButton
      ? `<button class="pay" id="pay-deposit">Pay deposit — ${money(estimate.deposit_amount)}</button>`
      : ""
  }
  ${
    showBalanceButton
      ? `<button class="pay" id="pay-balance">Pay balance — ${money(estimate.total_amount)}</button>`
      : ""
  }
  ${estimate.status === "paid" ? '<div class="banner">Paid in full — thank you!</div>' : ""}
</div>

<script>
  const token = ${JSON.stringify(token)};
  const functionsBase = ${JSON.stringify(FUNCTIONS_BASE_URL)};

  const canvas = document.getElementById('sig');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    let drawing = false;

    function point(e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const t = e.touches ? e.touches[0] : e;
      return [(t.clientX - rect.left) * scaleX, (t.clientY - rect.top) * scaleY];
    }
    function start(e) { drawing = true; const [x, y] = point(e); ctx.beginPath(); ctx.moveTo(x, y); e.preventDefault(); }
    function move(e) { if (!drawing) return; const [x, y] = point(e); ctx.lineTo(x, y); ctx.stroke(); e.preventDefault(); }
    function end() { drawing = false; }

    ['mousedown', 'touchstart'].forEach((evt) => canvas.addEventListener(evt, start));
    ['mousemove', 'touchmove'].forEach((evt) => canvas.addEventListener(evt, move));
    ['mouseup', 'mouseleave', 'touchend'].forEach((evt) => canvas.addEventListener(evt, end));

    document.getElementById('clear').addEventListener('click', () => ctx.clearRect(0, 0, canvas.width, canvas.height));
    document.getElementById('save').addEventListener('click', async (e) => {
      e.target.disabled = true;
      e.target.textContent = 'Saving…';
      const signatureDataUrl = canvas.toDataURL('image/png');
      const res = await fetch(window.location.pathname + '?token=' + encodeURIComponent(token), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureDataUrl }),
      });
      if (res.ok) window.location.reload();
      else { e.target.disabled = false; e.target.textContent = 'Save signature'; alert('Could not save signature.'); }
    });
  }

  async function pay(kind, buttonId) {
    const btn = document.getElementById(buttonId);
    btn.disabled = true;
    btn.textContent = 'Redirecting to secure checkout…';
    try {
      const res = await fetch(functionsBase + '/create-deposit-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, kind }),
      });
      const data = await res.json();
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
      else { alert(data.error || 'Could not start checkout.'); btn.disabled = false; }
    } catch {
      alert('Network error — please try again.');
      btn.disabled = false;
    }
  }

  document.getElementById('pay-deposit')?.addEventListener('click', () => pay('deposit', 'pay-deposit'));
  document.getElementById('pay-balance')?.addEventListener('click', () => pay('balance', 'pay-balance'));
</script>
</body>
</html>`;
}

function statusLabel(status: string) {
  return (
    {
      draft: "Draft",
      sent: "Awaiting Approval",
      deposit_paid: "Deposit Paid",
      invoiced: "Invoiced",
      paid: "Paid",
      overdue: "Overdue",
    } as Record<string, string>
  )[status] ?? status;
}

function escapeHtml(value: string) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function html(body: string, status = 200) {
  return new Response(body, { status, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
