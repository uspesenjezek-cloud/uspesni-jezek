-- Ohrani pravilen poslovni pomen delne kompenzacije tudi pri starejsem
-- izvedbenem RPC-ju, ki vse delne nedenarne poravnave vstavi kot credit_note.
create or replace function public.popravi_vrsto_delne_kompenzacije()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.vrsta = 'credit_note'
     and exists (
       select 1
       from public.opomin_ukrepi u
       where u.action_id = new.action_id
         and u.zadeva_id = new.zadeva_id
         and u.obrtnik_id = new.obrtnik_id
         and u.action_type = 'partial_settlement'
         and u.settings->>'kind' = 'compensation'
     ) then
    new.vrsta := 'compensation';
  end if;

  return new;
end;
$$;

drop trigger if exists zadeva_poravnave_delna_kompenzacija_trg
on public.zadeva_poravnave;

create trigger zadeva_poravnave_delna_kompenzacija_trg
before insert on public.zadeva_poravnave
for each row
execute function public.popravi_vrsto_delne_kompenzacije();

-- Enkrat popravi ze zapisane delne kompenzacije. Namenoma ne filtriramo po
-- statusu ukrepa: povezani action_id ter identiteta zadeve in obrtnika so
-- avtoritativna sled za zapis, ki ga je ustvarila ista atomska operacija.
update public.zadeva_poravnave p
set vrsta = 'compensation'
from public.opomin_ukrepi u
where p.vrsta = 'credit_note'
  and u.action_id = p.action_id
  and u.zadeva_id = p.zadeva_id
  and u.obrtnik_id = p.obrtnik_id
  and u.action_type = 'partial_settlement'
  and u.settings->>'kind' = 'compensation';

-- Resena zadeva je nespremenljiv revizijski zapis. Prehod iz aktivnega stanja
-- v Reseno ostane dovoljen, nadaljnja dejanska sprememba vrstice pa ne.
create or replace function public.prepreci_spremembe_resene_zadeve()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status = 'Rešeno'
     and new.* is distinct from old.* then
    raise exception using
      errcode = 'P0001',
      message = 'CASE_RESOLVED';
  end if;

  return new;
end;
$$;

drop trigger if exists zadeve_resen_primer_immutable_trg
on public.zadeve;

create trigger zadeve_resen_primer_immutable_trg
before update on public.zadeve
for each row
execute function public.prepreci_spremembe_resene_zadeve();
