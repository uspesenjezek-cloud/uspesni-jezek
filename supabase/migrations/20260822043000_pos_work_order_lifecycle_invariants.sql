-- Preserve the legal offer/order history even if a privileged code path is
-- changed later. Status, locked content, numbering and timestamps must always
-- describe one valid forward workflow (with cancellation allowed mid-flow).

alter table public.pos_work_orders
  add constraint pos_work_orders_lifecycle_check
  check (
    updated_at >= created_at
    and (locked_payload is null or locked_payload = payload)
    and ((locked_payload is null) = (offered_at is null))
    and ((order_number is null) = (accepted_at is null))
    and (accepted_at is null or offered_at is not null)
    and (started_at is null or accepted_at is not null)
    and (completed_at is null or started_at is not null)
    and (offered_at is null or offered_at >= created_at)
    and (accepted_at is null or accepted_at >= offered_at)
    and (started_at is null or started_at >= accepted_at)
    and (completed_at is null or completed_at >= started_at)
    and (
      cancelled_at is null
      or cancelled_at >= greatest(
        created_at,
        coalesce(offered_at, created_at),
        coalesce(accepted_at, created_at),
        coalesce(started_at, created_at),
        coalesce(completed_at, created_at)
      )
    )
    and case status
      when 'draft' then
        offered_at is null and accepted_at is null and started_at is null
        and completed_at is null and cancelled_at is null
      when 'offered' then
        offered_at is not null and accepted_at is null and started_at is null
        and completed_at is null and cancelled_at is null
      when 'accepted' then
        accepted_at is not null and started_at is null
        and completed_at is null and cancelled_at is null
      when 'in_progress' then
        started_at is not null and completed_at is null and cancelled_at is null
      when 'completed' then
        completed_at is not null and cancelled_at is null
      when 'invoiced' then
        completed_at is not null and cancelled_at is null
      when 'cancelled' then
        cancelled_at is not null
      else false
    end
  ) not valid;

alter table public.pos_work_orders
  validate constraint pos_work_orders_lifecycle_check;
