create table if not exists public."IntegrationConfig" (
  "key" text primary key,
  "value" jsonb not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create or replace function public.set_updated_at_integration_config()
returns trigger
language plpgsql
as $$
begin
  new."updatedAt" = now();
  return new;
end;
$$;

drop trigger if exists trg_integration_config_updated_at on public."IntegrationConfig";
create trigger trg_integration_config_updated_at
before update on public."IntegrationConfig"
for each row
execute function public.set_updated_at_integration_config();
