
grant select on table public.company_name_directory to authenticated;
create policy "Authenticated users can read public company names"
  on public.company_name_directory
  for select
  to authenticated
  using (true);;
