-- Recurring contracts (maintenance plans): a template that generates a new
-- estimate automatically on a schedule, for repeat clients (e.g. monthly
-- lawn care). Always tied to a client — a contract with no client to bill
-- doesn't mean anything.

create table recurring_contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references clients (id) on delete cascade,
  title text not null,
  frequency text not null check (frequency in ('weekly', 'monthly')),
  line_items_template jsonb not null default '[]',
  tax_rate numeric(5, 4) not null default 0,
  deposit_amount numeric(12, 2) not null default 0,
  next_run_at timestamptz not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recurring_contracts_user_id_idx on recurring_contracts (user_id);
create index recurring_contracts_client_id_idx on recurring_contracts (client_id);
create index recurring_contracts_next_run_at_idx on recurring_contracts (next_run_at);

create trigger recurring_contracts_set_updated_at before update on recurring_contracts
  for each row execute function set_updated_at();

alter table recurring_contracts enable row level security;

create policy "recurring_contracts: owner all" on recurring_contracts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
