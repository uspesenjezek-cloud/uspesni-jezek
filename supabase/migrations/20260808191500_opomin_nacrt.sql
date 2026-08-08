-- ==========================================================
-- Načrt opominjanja (korak 3): JSONB osnutek/potrjen načrt na zadevi.
--
-- MVP: celoten Plan objekt v enem stolpcu. Normalizirana tabela
-- opomin_koraki pride kasneje (ko bo cron poizvedoval zapadle korake).
--
-- KAKO POGNATI:
-- Supabase → SQL Editor → New query → prilepi CELOTNO → Run.
-- ==========================================================

alter table public.zadeve
  add column if not exists opomin_nacrt jsonb;

comment on column public.zadeve.opomin_nacrt is
  'Potrjen 4-korakni SMS načrt opominjanja (JSON). Ločen od ročnega statusa opomina.';
