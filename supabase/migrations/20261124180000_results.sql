-- The mark and the remarks of a defense, entered by the president of the jury.

-- Students see their result once the admin publishes the results.
alter table public.settings add column results_published boolean not null default false;
grant update (results_published) on public.settings to authenticated;

create table public.results (
  project_id uuid primary key references public.projects (id) on delete cascade,
  mark numeric(4, 2) not null check (mark between 0 and 20),
  remarks text check (char_length(remarks) <= 2000)
);

create function private.check_result() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.projects where id = new.project_id and status = 'defended'
  ) then
    raise exception 'not_defended';
  end if;
  -- Students may already have read it.
  if tg_op = 'UPDATE' and (select results_published from public.settings) then
    raise exception 'results_published';
  end if;
  return new;
end;
$$;

create trigger check_result
before insert or update on public.results
for each row execute function private.check_result();

create function private.is_president(project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_professor() and exists (
    select 1 from public.jury_members
    where project_id = project and professor_id = (select auth.uid())
      and jury_role = 'president'
  );
$$;

alter table public.results enable row level security;
revoke all on public.results from anon, authenticated;
grant select, insert (project_id, mark, remarks), update (mark, remarks)
on public.results to authenticated;

create policy "The jury and the admin read results, the students once published"
on public.results for select to authenticated
using (
  (select private.is_admin())
  or private.is_project_supervisor(project_id)
  or private.is_jury_member(project_id)
  or (
    (select results_published from public.settings)
    and private.is_project_student(project_id)
  )
);

create policy "Presidents enter results" on public.results for insert to authenticated
with check (private.is_president(project_id));

create policy "Presidents correct results" on public.results for update to authenticated
using (private.is_president(project_id)) with check (private.is_president(project_id));

revoke execute on all functions in schema private from public, anon;
grant execute on function private.is_president(uuid) to authenticated;
