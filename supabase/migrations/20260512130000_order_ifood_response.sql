-- Separa `externalRefs` em `ifoodResponse` + `integrationMeta` (nomenclatura alinhada ao iFood).

alter table public."Order" add column if not exists "ifoodResponse" jsonb;
alter table public."Order" add column if not exists "integrationMeta" jsonb;

update public."Order"
set
  "ifoodResponse" = case
    when "externalRefs" is null then null
    else ("externalRefs"->'ifood')::jsonb
  end,
  "integrationMeta" = case
    when "externalRefs" is null then null
    when coalesce(jsonb_strip_nulls(("externalRefs"::jsonb - 'ifood')), '{}'::jsonb) = '{}'::jsonb then null
    else (("externalRefs"::jsonb - 'ifood'))::jsonb
  end
where "externalRefs" is not null;

alter table public."Order" drop column if exists "externalRefs";
