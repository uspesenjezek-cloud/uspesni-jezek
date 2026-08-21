-- Mock DATEV preizkus za isto obdobje ne sme blokirati poznejšega
-- sandbox ali produkcijskega prenosa.
drop index if exists public.pos_datev_one_active_period_uidx;

create unique index pos_datev_one_active_period_environment_uidx
  on public.pos_datev_transfer_jobs(user_id, period, environment)
  where status in ('preparing','processing','succeeded');
