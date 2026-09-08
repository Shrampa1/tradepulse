-- TradePulse core schema: profiles, clients, estimates, line_items.
-- Row Level Security scopes every row to the tradesperson (auth.uid()) that
-- owns it. The one deliberate hole is the public-quote read path, which is
-- served by an edge function using the service role key (bypasses RLS) so an
-- unauthenticated customer can open a quote from a link without an account.

create extension if not exists "pgcrypto";

create type estimate_status as enum (
  'draft',
  'sent',
  'deposit_paid',
  'invoiced',
  'paid',
  'overdue'
);

-- One row per tradesperson, created on sign-up.
create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade unique,
  business_name text not null default '',
  phone text,
  payment_account_id text, -- reserved for a future multi-tenant payout integration
  tax_rate numeric(5, 4) not null default 0, -- e.g. 0.0825 = 8.25%
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table estimates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid references clients (id) on delete set null,
  status estimate_status not null default 'draft',
  job_address text,
  notes text,
  subtotal_amount numeric(12, 2) not null default 0,
  tax_rate numeric(5, 4) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  deposit_amount numeric(12, 2) not null default 0,
  public_token uuid unique default gen_random_uuid(),
  signature_data_url text,
  signed_at timestamptz,
  sent_at timestamptz,
  deposit_paid_at timestamptz,
  paid_at timestamptz,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table line_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references estimates (id) on delete cascade,
  description text not null,
  quantity numeric(10, 2) not null default 1,
  unit_price numeric(12, 2) not null default 0,
  total numeric(12, 2) generated always as (quantity * unit_price) stored,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Payment events recorded from the payment gateway's webhook, so the app has
-- an audit trail independent of the mutable status fields on `estimates`.
create table payments (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references estimates (id) on delete cascade,
  kind text not null check (kind in ('deposit', 'balance')),
  amount numeric(12, 2) not null,
  checkout_reference text unique, -- gateway's session/tracker id for this checkout attempt
  provider_payment_id text, -- gateway's id for the completed payment itself, once known
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  created_at timestamptz not null default now()
);

-- Log of simulated follow-up triggers for unpaid invoices (feature E). A real
-- SMS/email integration can later insert into and consume this table the
-- same way; for now it's the audit trail that proves the automation ran.
create table reminders (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references estimates (id) on delete cascade,
  channel text not null default 'simulated',
  message text not null,
  created_at timestamptz not null default now()
);

create index estimates_user_id_idx on estimates (user_id);
create index estimates_client_id_idx on estimates (client_id);
create index estimates_status_idx on estimates (status);
create index clients_user_id_idx on clients (user_id);
create index line_items_estimate_id_idx on line_items (estimate_id);
create index payments_estimate_id_idx on payments (estimate_id);
create index reminders_estimate_id_idx on reminders (estimate_id);

-- updated_at maintenance -----------------------------------------------------

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_set_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger clients_set_updated_at before update on clients
  for each row execute function set_updated_at();
create trigger estimates_set_updated_at before update on estimates
  for each row execute function set_updated_at();

-- Keep estimate totals in sync whenever line items change, so the client app
-- never has to trust a total it computed itself.
create or replace function recalculate_estimate_totals()
returns trigger as $$
declare
  target_estimate_id uuid := coalesce(new.estimate_id, old.estimate_id);
  v_subtotal numeric(12, 2);
  v_tax_rate numeric(5, 4);
begin
  select coalesce(sum(total), 0) into v_subtotal
  from line_items where estimate_id = target_estimate_id;

  select tax_rate into v_tax_rate from estimates where id = target_estimate_id;

  update estimates
  set
    subtotal_amount = v_subtotal,
    tax_amount = round(v_subtotal * v_tax_rate, 2),
    total_amount = v_subtotal + round(v_subtotal * v_tax_rate, 2)
  where id = target_estimate_id;

  return null;
end;
$$ language plpgsql;

create trigger line_items_recalculate_totals
  after insert or update or delete on line_items
  for each row execute function recalculate_estimate_totals();

-- New sign-up -> profile row -------------------------------------------------

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, business_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'business_name', ''));
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Row Level Security ----------------------------------------------------------

alter table profiles enable row level security;
alter table clients enable row level security;
alter table estimates enable row level security;
alter table line_items enable row level security;
alter table payments enable row level security;
alter table reminders enable row level security;

create policy "profiles: owner read" on profiles
  for select using (auth.uid() = user_id);
create policy "profiles: owner update" on profiles
  for update using (auth.uid() = user_id);

create policy "clients: owner all" on clients
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "estimates: owner all" on estimates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- line_items has no user_id column; ownership is derived through its parent
-- estimate so RLS still ultimately traces back to auth.uid().
create policy "line_items: owner all" on line_items
  for all using (
    exists (
      select 1 from estimates
      where estimates.id = line_items.estimate_id
      and estimates.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from estimates
      where estimates.id = line_items.estimate_id
      and estimates.user_id = auth.uid()
    )
  );

create policy "payments: owner read" on payments
  for select using (
    exists (
      select 1 from estimates
      where estimates.id = payments.estimate_id
      and estimates.user_id = auth.uid()
    )
  );

create policy "reminders: owner read" on reminders
  for select using (
    exists (
      select 1 from estimates
      where estimates.id = reminders.estimate_id
      and estimates.user_id = auth.uid()
    )
  );

-- Storage: job-site photos ----------------------------------------------------

insert into storage.buckets (id, name, public)
values ('job-photos', 'job-photos', false)
on conflict (id) do nothing;

create policy "job-photos: owner read" on storage.objects
  for select using (bucket_id = 'job-photos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "job-photos: owner write" on storage.objects
  for insert with check (bucket_id = 'job-photos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "job-photos: owner delete" on storage.objects
  for delete using (bucket_id = 'job-photos' and auth.uid()::text = (storage.foldername(name))[1]);
