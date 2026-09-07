-- Read-only regression against the actual installed function bodies.
-- Evaluates the deployed terminal expression rather than a duplicated JS rule.
do $$
declare
  body text := pg_get_functiondef('private._pos_reconcile_openapi_invoice_event(text,text,text,timestamptz,boolean,timestamptz)'::regprocedure);
  claim_body text := pg_get_functiondef('private._pos_claim_openapi_reconciliation(text,boolean,timestamptz)'::regprocedure);
  expression text;
  sample record;
  actual boolean;
begin
  if body not like '%last_reconciled_at = v_checked_at%'
    or body not like '%reconciliation_attempt_count between 1 and 7%'
    or body ~ 'reconciliation_attempt_count\s*='
    or body not like '%when v_terminal or reconciliation_attempt_count >= 7 then null%'
    or body not like '%interval ''6 hours''%' then
    raise exception 'Openapi completion lost claim lease / bounded retry contract';
  end if;
  if claim_body not like '%for update skip locked%'
    or claim_body not like '%reconciliation_attempt_count = v_attempts%'
    or claim_body not like '%reconciliation_attempt_count < 7%' then
    raise exception 'Openapi attempt must be atomically consumed at claim';
  end if;
  expression := substring(body from 'v_terminal := ([\s\S]*?);');
  if expression is null then raise exception 'Missing terminal expression'; end if;
  for sample in select * from (values
    ('SENT','succeeded',true), (' sent ',' SUCCEEDED ',true),
    ('SENT','processing',false), ('NEW','succeeded',false),
    ('DONE','',true), ('ERROR','',true), (null,null,false)
  ) cases(state,external_status,expected) loop
    execute 'select ' || replace(replace(expression,'p_external_status',quote_nullable(sample.external_status)),
      'p_state',quote_nullable(sample.state)) into actual;
    if actual is distinct from sample.expected then
      raise exception 'Incorrect deployed Openapi terminal semantics for %/%',sample.state,sample.external_status;
    end if;
  end loop;
  if has_function_privilege('anon','private._pos_reconcile_openapi_invoice_event(text,text,text,timestamptz,boolean,timestamptz)','EXECUTE')
    or has_function_privilege('authenticated','private._pos_reconcile_openapi_invoice_event(text,text,text,timestamptz,boolean,timestamptz)','EXECUTE')
    or not has_function_privilege('service_role','private._pos_reconcile_openapi_invoice_event(text,text,text,timestamptz,boolean,timestamptz)','EXECUTE') then
    raise exception 'Unsafe Openapi reconciliation grants';
  end if;
end;
$$;
