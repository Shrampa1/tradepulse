# TradePulse

A mobile-first quote-to-invoice app for independent tradespeople (contractors, landscapers, cleaners), built as a native **iOS/Android app with Expo + React Native**, backed by **Supabase** (Postgres, Auth, Storage, Edge Functions), **Google Gemini** (voice/photo → line items), and **Safepay** (deposits/payments — a Pakistan-based gateway, since Stripe doesn't onboard Pakistani merchants).

> Placeholder icons: `assets/icon.png`, `assets/splash.png`, `assets/adaptive-icon.png` are 1×1 stand-ins so the project runs. Replace them with real 1024×1024 artwork before a store submission.

## Architecture

- **Mobile app** (`app/`, `src/`) — Expo Router + NativeWind (Tailwind for React Native). This is the tradesperson's app: dashboard, AI estimate builder, client CRM. Talks to Postgres directly via `@supabase/supabase-js` (RLS-scoped to `auth.uid()`).
- **Supabase Edge Functions** (`supabase/functions/`) — the only place secret keys (Gemini, Safepay) live. There's no separate Next.js/Node backend; Edge Functions are the API layer.
  - `parse-line-items` — voice transcript/audio or a job photo → structured line items (Gemini; it handles audio and images natively in one call, no separate transcription step).
  - `send-estimate` — marks an estimate sent, returns its public link.
  - `create-deposit-session` — creates a Safepay Express Checkout hosted payment link for a deposit or balance payment.
  - `safepay-webhook` — verifies Safepay's HMAC signature, marks payments/estimates paid.
  - `public-quote` — renders the framework-free HTML page a **customer** opens from the shared link (no app install required) to view the quote, sign, and pay.
  - `check-overdue-invoices` — feature E: flips overdue invoices and logs a simulated follow-up reminder; meant to run on a schedule.
- **Supabase Postgres** (`supabase/migrations/0001_init.sql`) — `profiles`, `clients`, `estimates`, `line_items`, plus `payments` and `reminders` to support features D/E, all RLS-protected.

## Prerequisites

This was authored in a sandbox with no Node.js/npm available, so nothing has been installed or run yet. You'll need, on your own machine:

- Node.js 20+ and npm
- [Expo Go](https://expo.dev/go) on your phone (fastest way to run it), or Xcode/Android Studio for simulators
- The [Supabase CLI](https://supabase.com/docs/guides/cli)
- A Supabase project, a Gemini API key ([aistudio.google.com/apikey](https://aistudio.google.com/apikey)), and a [Safepay](https://getsafepay.pk/) sandbox account

## Setup

```bash
npm install
cp .env.example .env
cp supabase/functions/.env.example supabase/functions/.env
```

Fill in `.env` (client-safe, `EXPO_PUBLIC_*` only — no secret keys) and `supabase/functions/.env` (server-side secrets).

### Database

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

This applies `supabase/migrations/0001_init.sql`: tables, RLS policies, the `job-photos` storage bucket, and the triggers that keep `estimates.subtotal_amount/tax_amount/total_amount` in sync with `line_items` and that create a `profiles` row on sign-up.

### Edge Functions

```bash
supabase functions deploy parse-line-items send-estimate create-deposit-session safepay-webhook public-quote check-overdue-invoices
supabase secrets set --env-file supabase/functions/.env
```

Set `PUBLIC_QUOTE_BASE_URL` in `supabase/functions/.env` to the deployed `public-quote` function's URL (e.g. `https://<project-ref>.supabase.co/functions/v1/public-quote`) before deploying — it's what "Send to Client" links point at.

In your Safepay Dashboard, go to Developers → Endpoints → Add an endpoint, point it at your deployed `safepay-webhook` function URL, subscribe it to the `payment.succeeded` event, then copy its **shared secret** into `SAFEPAY_WEBHOOK_SECRET`.

> **Heads up on the Safepay integration specifically**: `create-deposit-session` was written against Safepay's published docs for their "Express Checkout" flow (session creation and the final redirect URL are both confirmed exactly from their docs site). One middle step — the `/client/passport/v1/token` call — isn't fully documented publicly; the function's source has a comment on exactly what's uncertain there and how to spot it if that call needs adjusting once you test against your sandbox.

### Automated reminders (feature E)

`check-overdue-invoices` is designed to be invoked daily, not by the app. Easiest option — Supabase's built-in cron (Dashboard → Database → Cron Jobs, or via `pg_cron`/`pg_net`):

```sql
select cron.schedule(
  'tradepulse-overdue-check',
  '0 9 * * *', -- daily at 09:00 UTC
  $$
  select net.http_post(
    url := '<your-project-ref>.supabase.co/functions/v1/check-overdue-invoices',
    headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET from your .env>')
  );
  $$
);
```

### Run the app

```bash
npm start
```

Scan the QR code with Expo Go (iOS/Android), or press `i`/`a` for a simulator/emulator.

## Notes on scope

- Payment happens on the public web page (`public-quote`), not inside the native app — the customer receiving a quote doesn't have TradePulse installed, so that page has to be a plain link that works in any mobile browser. There's no multi-tenant payout split here (`profiles.payment_account_id` is reserved for that); as built, deposits/invoices are collected directly into one Safepay account, which is enough for a single-tenant test but would need a payout-splitting integration before onboarding multiple tradespeople with money routed to their own bank accounts.
- "New Quick Invoice" reuses the same estimate builder as "New Estimate", but skips the voice/photo capture and creates the record with `status = 'invoiced'` immediately instead of `draft`.
- Signatures are stored as a PNG data URL on `estimates.signature_data_url`; there's no separate signatures table since only one signature per estimate is needed.
- Job-site photos are sent straight to `parse-line-items` for one-off analysis and aren't persisted — the `job-photos` Storage bucket/policies exist in the migration for if/when you want to keep the photo attached to the estimate, but nothing currently uploads to it.
