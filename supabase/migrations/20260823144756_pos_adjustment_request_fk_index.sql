create index pos_adjustment_requests_adjustment_tenant_idx
  on private.pos_adjustment_requests(adjustment_id, user_id);;
