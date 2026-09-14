-- Appointments: a job-calendar entry. Optionally linked to a client and/or
-- an estimate (job), but can also stand alone (e.g. a site visit to quote
-- work that hasn't become an estimate yet).

create table appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  estimate_id uuid references estimates (id) on delete set null,
  client_id uuid references clients (id) on delete set null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index appointments_user_id_idx on appointments (user_id);
create index appointments_starts_at_idx on appointments (starts_at);

create trigger appointments_set_updated_at before update on appointments
  for each row execute function set_updated_at();

alter table appointments enable row level security;

create policy "appointments: owner all" on appointments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
