-- Expenses: covers material receipts (AI-scanned or manual), mileage, labor,
-- and misc costs under one table/kind rather than parallel schemas, since a
-- receipt is just an expense with a photo and mileage is just an expense
-- whose amount is derived from miles * profiles.mileage_rate. Optionally
-- linked to a job (estimate) for per-job profit, and/or a client for
-- filtering when it isn't job-linked.

alter table profiles add column mileage_rate numeric(6, 3) not null default 0.670;

create table expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  estimate_id uuid references estimates (id) on delete set null,
  client_id uuid references clients (id) on delete set null,
  kind text not null default 'other' check (kind in ('material', 'mileage', 'labor', 'other')),
  description text not null,
  amount numeric(12, 2) not null default 0,
  miles numeric(8, 2),
  receipt_photo_path text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expenses_user_id_idx on expenses (user_id);
create index expenses_estimate_id_idx on expenses (estimate_id);
create index expenses_occurred_at_idx on expenses (occurred_at);

create trigger expenses_set_updated_at before update on expenses
  for each row execute function set_updated_at();

alter table expenses enable row level security;

create policy "expenses: owner all" on expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Storage: receipt photos ------------------------------------------------

insert into storage.buckets (id, name, public)
values ('receipt-photos', 'receipt-photos', false)
on conflict (id) do nothing;

create policy "receipt-photos: owner read" on storage.objects
  for select using (bucket_id = 'receipt-photos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "receipt-photos: owner write" on storage.objects
  for insert with check (bucket_id = 'receipt-photos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "receipt-photos: owner delete" on storage.objects
  for delete using (bucket_id = 'receipt-photos' and auth.uid()::text = (storage.foldername(name))[1]);
