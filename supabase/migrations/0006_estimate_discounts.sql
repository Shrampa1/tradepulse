-- Discounts on estimates: a fixed dollar amount or a percentage, applied to
-- the subtotal before tax. discount_amount is computed/stored the same way
-- tax_amount already is, so the app never has to trust a number it derived
-- itself.
alter table estimates add column discount_type text not null default 'fixed' check (discount_type in ('fixed', 'percent'));
alter table estimates add column discount_value numeric(12, 2) not null default 0;
alter table estimates add column discount_amount numeric(12, 2) not null default 0;

-- Replaces the 0001_init.sql version: same line-item-triggered recalculation,
-- now also discounting the subtotal before computing tax.
create or replace function recalculate_estimate_totals()
returns trigger as $$
declare
  target_estimate_id uuid := coalesce(new.estimate_id, old.estimate_id);
  v_subtotal numeric(12, 2);
  v_tax_rate numeric(5, 4);
  v_discount_type text;
  v_discount_value numeric(12, 2);
  v_discount_amount numeric(12, 2);
  v_taxable numeric(12, 2);
begin
  select coalesce(sum(total), 0) into v_subtotal
  from line_items where estimate_id = target_estimate_id;

  select tax_rate, discount_type, discount_value
  into v_tax_rate, v_discount_type, v_discount_value
  from estimates where id = target_estimate_id;

  v_discount_amount := case
    when v_discount_type = 'percent' then round(v_subtotal * (v_discount_value / 100), 2)
    else least(v_discount_value, v_subtotal)
  end;
  v_taxable := v_subtotal - v_discount_amount;

  update estimates
  set
    subtotal_amount = v_subtotal,
    discount_amount = v_discount_amount,
    tax_amount = round(v_taxable * v_tax_rate, 2),
    total_amount = v_taxable + round(v_taxable * v_tax_rate, 2)
  where id = target_estimate_id;

  return null;
end;
$$ language plpgsql;

-- The line-item trigger above only fires when line_items change. Editing the
-- discount or tax rate directly on the estimate itself needs its own
-- recalculation, driven off the estimate's current (already-correct)
-- subtotal_amount.
create or replace function recalculate_estimate_totals_on_estimate_change()
returns trigger as $$
declare
  v_discount_amount numeric(12, 2);
  v_taxable numeric(12, 2);
begin
  v_discount_amount := case
    when new.discount_type = 'percent' then round(new.subtotal_amount * (new.discount_value / 100), 2)
    else least(new.discount_value, new.subtotal_amount)
  end;
  v_taxable := new.subtotal_amount - v_discount_amount;

  new.discount_amount := v_discount_amount;
  new.tax_amount := round(v_taxable * new.tax_rate, 2);
  new.total_amount := v_taxable + new.tax_amount;

  return new;
end;
$$ language plpgsql;

create trigger estimates_recalculate_on_change
  before update of discount_type, discount_value, tax_rate on estimates
  for each row execute function recalculate_estimate_totals_on_estimate_change();
