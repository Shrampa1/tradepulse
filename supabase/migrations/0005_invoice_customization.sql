-- Lets a tradesperson customize what appears on their invoices/quotes.
-- business_name and phone already existed (set at sign-up, never editable);
-- these are the rest of a typical invoice letterhead.
alter table profiles add column business_tagline text;
alter table profiles add column business_address text;
alter table profiles add column business_fax text;
