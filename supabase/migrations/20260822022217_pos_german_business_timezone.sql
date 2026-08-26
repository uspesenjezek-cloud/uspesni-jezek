-- PostgreSQL sessions commonly run in UTC. POS document years, offer expiry
-- checks and finAPI import filenames describe German business dates, so pin
-- the relevant privileged routines to Europe/Berlin around UTC midnight.

alter function private._pos_create_invoice_adjustment(uuid,text,text,jsonb,boolean)
  set timezone = 'Europe/Berlin';

alter function private._pos_save_work_order(uuid,jsonb)
  set timezone = 'Europe/Berlin';

alter function private._pos_transition_work_order(uuid,text)
  set timezone = 'Europe/Berlin';

alter function private._pos_import_finapi_transactions(text,jsonb)
  set timezone = 'Europe/Berlin';

;
