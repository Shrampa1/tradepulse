-- A free-text label the user can set instead of being limited to the 4 fixed
-- `kind`s (which stay as-is — `kind` still drives the mileage-rate math).
alter table expenses add column category text;
