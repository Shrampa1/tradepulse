-- Richer Settings (custom invoice letterhead fields, invoice numbering,
-- payment terms, the app's own display currency) and Profile-tab personal
-- info (full_name — email/password already live on auth.users).
alter table profiles add column custom_invoice_fields jsonb not null default '[]';
alter table profiles add column invoice_number_prefix text not null default '';
alter table profiles add column next_invoice_number integer not null default 1;
alter table profiles add column default_payment_terms_days integer not null default 14;
alter table profiles add column currency text not null default 'USD';
alter table profiles add column full_name text;

alter table estimates add column invoice_number text;
