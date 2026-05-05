create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Garante idempotencia ao recriar os mesmos jobs.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'ifood-outbox-every-minute') then
    perform cron.unschedule('ifood-outbox-every-minute');
  end if;
  if exists (select 1 from cron.job where jobname = 'ifood-reconcile-every-10-min') then
    perform cron.unschedule('ifood-reconcile-every-10-min');
  end if;
end
$$;

select
  cron.schedule(
    'ifood-outbox-every-minute',
    '* * * * *',
    $job$
    select
      net.http_post(
        url := 'https://anori-frozen.vercel.app/api/integrations/ifood/outbox',
        headers := '{"content-type":"application/json"}'::jsonb,
        body := '{}'::jsonb
      );
    $job$
  );

select
  cron.schedule(
    'ifood-reconcile-every-10-min',
    '*/10 * * * *',
    $job$
    select
      net.http_post(
        url := 'https://anori-frozen.vercel.app/api/integrations/ifood/reconcile',
        headers := '{"content-type":"application/json"}'::jsonb,
        body := '{}'::jsonb
      );
    $job$
  );
