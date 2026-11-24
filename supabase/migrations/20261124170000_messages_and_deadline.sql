-- A discussion per project, and the date when reports are due.

-- The moment when a report becomes late, or null. Late reports are accepted, only marked.
alter table public.settings add column report_deadline timestamptz;
grant update (report_deadline) on public.settings to authenticated;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id),
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index messages_by_project on public.messages (project_id, created_at);

-- "security_invoker" makes the view follow the policies of the person who reads it.
create view public.last_messages with (security_invoker = true) as
select distinct on (project_id) project_id, author_id
from public.messages
order by project_id, created_at desc;

alter table public.messages enable row level security;
revoke all on public.messages, public.last_messages from anon, authenticated;

-- Messages cannot be edited or deleted. The author is filled in by the column default.
grant select, insert (project_id, body) on public.messages to authenticated;
grant select on public.last_messages to authenticated;

-- Neither the jury nor the admin reads the discussion.
create policy "The students and the supervisor read the discussion"
on public.messages for select to authenticated
using (private.is_project_student(project_id) or private.is_project_supervisor(project_id));

create policy "The students and the supervisor write" on public.messages
for insert to authenticated
with check (
  author_id = (select auth.uid())
  and (private.is_project_student(project_id) or private.is_project_supervisor(project_id))
);
