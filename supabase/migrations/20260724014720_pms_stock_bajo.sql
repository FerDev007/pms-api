-- app/pms/api.py filters supplies with `Suministro.stock <= Suministro.stock_minimo`.
-- PostgREST has no column-to-column comparison, and doing it in the Edge Function
-- would break server-side pagination (you cannot LIMIT before you filter). A stored
-- generated column keeps the predicate in the database where it belongs.
alter table pms_suministro
    add column stock_bajo boolean generated always as (stock <= stock_minimo) stored;

create index ix_pms_suministro_stock_bajo on pms_suministro (stock_bajo);
