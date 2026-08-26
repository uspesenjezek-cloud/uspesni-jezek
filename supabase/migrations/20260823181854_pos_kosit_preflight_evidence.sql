-- Store only server-created evidence that the exact draft payload passed the
-- configured KoSIT validator shortly before immutable issuance.

create table public.pos_einvoice_preflight_validations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  draft_id uuid not null,
  payload jsonb not null check (jsonb_typeof(payload)='object' and octet_length(payload::text)<=524288),
  xml_sha256 text not null check (xml_sha256~'^[0-9a-f]{64}$'),
  validator_name text not null check (validator_name='KoSIT'),
  validator_version text not null check (char_length(validator_version) between 1 and 80),
  validator_config_version text not null check (char_length(validator_config_version) between 1 and 80),
  validation_report jsonb not null check (jsonb_typeof(validation_report)='object' and octet_length(validation_report::text)<=65536),
  validated_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (expires_at>validated_at and expires_at<=validated_at+interval '30 minutes')
);

create index pos_einvoice_preflight_user_draft_valid_idx
  on public.pos_einvoice_preflight_validations(user_id,draft_id,expires_at desc);

alter table public.pos_einvoice_preflight_validations enable row level security;
revoke all on table public.pos_einvoice_preflight_validations from public,anon,authenticated;
grant select,insert on table public.pos_einvoice_preflight_validations to service_role;

create or replace function private.pos_has_einvoice_preflight(p_draft_id uuid,p_payload jsonb)
returns boolean language sql stable security definer set search_path=''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.pos_einvoice_preflight_validations evidence
    where evidence.user_id=(select auth.uid()) and evidence.draft_id=p_draft_id
      and evidence.payload=p_payload and evidence.expires_at>now()
      and evidence.validated_at<=now() and evidence.validator_name='KoSIT'
  );
$$;

revoke all on function private.pos_has_einvoice_preflight(uuid,jsonb) from public,anon,authenticated;
grant execute on function private.pos_has_einvoice_preflight(uuid,jsonb) to service_role;

create or replace function private._pos_issue_invoice_validated(
  p_draft_id uuid,p_payload jsonb,p_final_confirmed boolean,p_einvoice_validated boolean default false
)
returns public.pos_invoices language sql security definer set search_path=''
as $$
  select private._pos_issue_invoice(
    p_draft_id,
    private.pos_validate_invoice_tax_evidence(private.pos_validate_invoice_payload(
      private.pos_validate_invoice_party_fields(p_payload||jsonb_build_object(
        'seller_contact_phone',coalesce((select business_phone from public.pos_business_profiles where user_id=(select auth.uid())),'')
      ))
    )),
    p_final_confirmed,
    private.pos_has_einvoice_preflight(p_draft_id,p_payload)
  );
$$;

create or replace function private._pos_issue_replacement_invoice_validated(
  p_draft_id uuid,p_payload jsonb,p_final_confirmed boolean,p_einvoice_validated boolean default false,
  p_cancellation_adjustment_id uuid default null
)
returns public.pos_invoices language sql security definer set search_path=''
as $$
  select private._pos_issue_replacement_invoice(
    p_draft_id,
    private.pos_validate_invoice_tax_evidence(private.pos_validate_invoice_payload(
      private.pos_validate_invoice_party_fields(p_payload||jsonb_build_object(
        'seller_contact_phone',coalesce((select business_phone from public.pos_business_profiles where user_id=(select auth.uid())),'')
      ))
    )),
    p_final_confirmed,
    private.pos_has_einvoice_preflight(p_draft_id,p_payload),
    p_cancellation_adjustment_id
  );
$$;

revoke all on function private._pos_issue_invoice_validated(uuid,jsonb,boolean,boolean) from public,anon,authenticated;
revoke all on function private._pos_issue_replacement_invoice_validated(uuid,jsonb,boolean,boolean,uuid) from public,anon,authenticated;
grant execute on function private._pos_issue_invoice_validated(uuid,jsonb,boolean,boolean) to service_role;
grant execute on function private._pos_issue_replacement_invoice_validated(uuid,jsonb,boolean,boolean,uuid) to service_role;

notify pgrst,'reload schema';

;
