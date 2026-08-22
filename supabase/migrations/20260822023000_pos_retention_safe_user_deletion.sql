-- auth.users is the current POS tenant root and most early POS tables used
-- ON DELETE CASCADE. Prevent an account deletion from erasing a legal invoice
-- in the short interval before its PDF/archive manifest exists. Archived test
-- evidence is protected too; test-only accounts without archive records remain
-- deletable. A future offboarding flow can detach authentication only after it
-- has moved retained documents to a stable legal-account owner.

create or replace function private.pos_block_unsafe_auth_user_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.pos_invoices as invoice
    where invoice.user_id = old.id
      and not invoice.is_test
  ) or exists (
    select 1
    from public.pos_archive_records as archive_record
    where archive_record.user_id = old.id
  ) then
    raise exception using
      errcode = '23503',
      message = 'Uporabniškega računa ni mogoče izbrisati, ker vsebuje dokumente z zakonsko hrambo.',
      detail = 'Dostop deaktivirajte; račun in arhiv morata ostati nespremenjena do retention-safe offboardinga.',
      hint = 'Ne brišite auth uporabnika, dokler pravni in arhivski POS zapisi niso varno preneseni na trajnega pravnega nosilca.';
  end if;
  return old;
end;
$$;

drop trigger if exists pos_auth_user_retention_guard on auth.users;
create trigger pos_auth_user_retention_guard
before delete on auth.users
for each row execute function private.pos_block_unsafe_auth_user_delete();

revoke all on function private.pos_block_unsafe_auth_user_delete() from public, anon, authenticated;
grant execute on function private.pos_block_unsafe_auth_user_delete() to service_role;
