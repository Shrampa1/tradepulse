-- Temporary debugging aid: the first native Android build of this app
-- crashes to a blank screen on launch with no on-device way to see why
-- (no USB debugging, no Wi-Fi available to pair a wireless adb session).
-- This table lets the app report a crash to Supabase directly over its
-- normal internet connection (mobile data is enough) the moment one
-- happens, so the crash can be read from the Supabase dashboard's Table
-- Editor instead of a device log. See src/lib/crashReporter.ts for the
-- client side. Safe to drop once the native build is stable -- this
-- isn't part of the app's real feature set.
create table if not exists public.crash_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  platform text,
  message text,
  stack text,
  is_fatal boolean
);

alter table public.crash_reports enable row level security;

-- Insert-only for anyone (including signed-out users, since a crash on
-- launch happens before any login) -- no select/update/delete policy is
-- defined, so only the project owner (via the dashboard or the
-- service role) can ever read these back.
create policy "anyone can report a crash"
  on public.crash_reports
  for insert
  to anon, authenticated
  with check (true);
