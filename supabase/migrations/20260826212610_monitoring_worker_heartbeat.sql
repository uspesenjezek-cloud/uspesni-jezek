-- Vercel Hobby dovoli samo dnevni cron, uporabnik pa lahko izbere poljubno
-- minuto. Supabase zato vsako minuto prebudi istega varovanega delavca.
-- Skrivnosti se ne zapisujejo v migracijo. Pred vklopom produkcije morata v
-- Vaultu obstajati `uspesni_jezek_app_url` in `uspesni_jezek_cron_secret`.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

select cron.schedule(
  'uj-monitoring-worker-heartbeat',
  '* * * * *',
  $job$
    select net.http_post(
      url := rtrim(settings.app_url, '/') || '/api/mehka-boniteta-delavec',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || settings.cron_secret
      ),
      body := jsonb_build_object('source', 'supabase-monitoring-heartbeat'),
      timeout_milliseconds := 10000
    ) as request_id
    from (
      select
        (select decrypted_secret from vault.decrypted_secrets where name = 'uspesni_jezek_app_url' limit 1) as app_url,
        (select decrypted_secret from vault.decrypted_secrets where name = 'uspesni_jezek_cron_secret' limit 1) as cron_secret
    ) settings
    where settings.app_url ~ '^https://[a-zA-Z0-9.-]+(:[0-9]+)?$'
      and length(settings.cron_secret) >= 16
  $job$
);
