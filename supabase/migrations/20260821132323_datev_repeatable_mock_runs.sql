-- Zakljuceni mock preizkusi so zgodovinski posnetki. Novi racuni morajo
-- ustvariti nov posnetek, medtem ko podvojeni socasni zagon ostane blokiran.
drop index if exists public.pos_datev_one_active_period_environment_uidx;

create unique index pos_datev_one_active_period_non_mock_uidx
  on public.pos_datev_transfer_jobs(user_id, period, environment)
  where environment <> 'mock'
    and status in ('preparing','processing','succeeded');

create unique index pos_datev_one_running_mock_period_uidx
  on public.pos_datev_transfer_jobs(user_id, period, environment)
  where environment = 'mock'
    and status in ('preparing','processing');
