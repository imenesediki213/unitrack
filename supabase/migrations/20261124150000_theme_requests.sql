-- Students ask for an open theme. When the professor accepts, the project is created.
--
-- Functions lock rows in the same order (theme, student, request), so that two of them
-- wait for each other instead of blocking each other.

-- taken: the theme has all its students.
alter type public.theme_status add value 'taken';

create type public.request_status as enum ('pending', 'accepted', 'refused', 'cancelled');

create table public.theme_requests (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid not null references public.themes (id) on delete cascade,
  student_id uuid not null references public.profiles (id),
  -- Empty when the theme is the student's own idea.
  message text check (char_length(trim(message)) between 10 and 1000),
  status public.request_status not null default 'pending',
  reply text check (char_length(reply) <= 1000),
  created_at timestamptz not null default now()
);

-- A refusal is final, so the student cannot ask for the same theme again.
create unique index one_request_per_theme
on public.theme_requests (theme_id, student_id) where status <> 'cancelled';

alter table public.projects add column theme_id uuid unique references public.themes (id);

-- Asking for a theme --------------------------------------------------------------------

-- Ideas that wait for an answer count too. The lock stops two requests sent at the same time
-- from both being the third one.
create function private.check_request_limit(student uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  waiting integer;
begin
  perform 1 from public.profiles where id = student for update;

  select
    (select count(*) from public.theme_requests
      where student_id = student and status = 'pending')
    + (select count(*) from public.themes
      where proposed_by = student and status in ('proposed', 'pending'))
  into waiting;

  if waiting >= 3 then
    raise exception 'too_many_requests';
  end if;
end;
$$;

create function private.prepare_request() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  theme_is_open boolean;
begin
  -- Only students use the API here. The other callers are trusted functions and the seed script.
  if private.current_user_role() is distinct from 'student' then
    return new;
  end if;
  new.student_id := (select auth.uid());

  if not (select themes_open from public.settings) then
    raise exception 'themes_closed';
  end if;

  -- The theme cannot be given away while this request is being added.
  select status = 'open' into theme_is_open
  from public.themes where id = new.theme_id for share;
  if theme_is_open is not true then
    raise exception 'theme_not_open';
  end if;

  perform private.check_request_limit(new.student_id);
  if exists (select 1 from public.project_students where student_id = new.student_id) then
    raise exception 'already_has_project';
  end if;
  return new;
end;
$$;

create trigger prepare_request
before insert on public.theme_requests
for each row execute function private.prepare_request();

create function private.check_idea_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if private.current_user_role() = 'student' then
    perform private.check_request_limit((select auth.uid()));
  end if;
  return new;
end;
$$;

create trigger check_idea_limit
before insert on public.themes
for each row execute function private.check_idea_limit();

-- Answering -----------------------------------------------------------------------------

-- The caller has locked the theme and the student.
create function private.accept_request(request uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  accepted public.theme_requests;
  theme public.themes;
  project public.projects;
begin
  update public.theme_requests set status = 'accepted' where id = request returning * into accepted;
  select * into theme from public.themes where id = accepted.theme_id;

  -- The second student of a theme joins the project of the first one.
  select * into project from public.projects where theme_id = theme.id;
  if project.id is null then
    insert into public.projects (title, supervisor_id, theme_id)
    values (theme.title, theme.professor_id, theme.id)
    returning * into project;
  elsif project.status <> 'in_progress' then
    raise exception 'project_not_in_progress';
  end if;

  insert into public.project_students (project_id, student_id)
  values (project.id, accepted.student_id);

  if (select count(*) from public.project_students where project_id = project.id) >= theme.capacity
  then
    update public.themes set status = 'taken' where id = theme.id;
    update public.theme_requests set status = 'cancelled'
    where theme_id = theme.id and status = 'pending';
  end if;
end;
$$;

create function public.answer_request(request uuid, accepted boolean, reason text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  current public.theme_requests;
  professor uuid;
begin
  select * into current from public.theme_requests where id = request;
  select professor_id into professor
  from public.themes where id = current.theme_id for update;

  if not private.is_professor() or professor is distinct from (select auth.uid()) then
    raise exception 'not_allowed';
  end if;

  -- Another professor may have accepted the same student while this one was waiting.
  perform 1 from public.profiles where id = current.student_id for update;
  select * into current from public.theme_requests where id = request for update;
  if current.status is distinct from 'pending' then
    raise exception 'request_already_answered';
  end if;

  if accepted then
    perform private.accept_request(request);
  elsif coalesce(trim(reason), '') = '' then
    raise exception 'reason_required';
  else
    update public.theme_requests set status = 'refused', reply = reason where id = request;
  end if;
end;
$$;

-- An approved idea goes to the student who had it, unless they found a project meanwhile.
create function private.give_idea_to_author() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  request uuid;
begin
  perform 1 from public.profiles where id = new.proposed_by for update;

  if not exists (select 1 from public.project_students where student_id = new.proposed_by) then
    insert into public.theme_requests (theme_id, student_id)
    values (new.id, new.proposed_by)
    returning id into request;
    perform private.accept_request(request);
  end if;
  return null;
end;
$$;

create trigger give_idea_to_author
after update of status on public.themes
for each row
when (
  new.proposed_by is not null and new.status = 'open' and old.status in ('proposed', 'pending')
)
execute function private.give_idea_to_author();

-- Keeping requests and projects in agreement ----------------------------------------------

-- Also when the admin adds the student to a project directly.
create function private.cancel_other_requests() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.theme_requests set status = 'cancelled'
  where student_id = new.student_id and status = 'pending';
  return null;
end;
$$;

create trigger cancel_other_requests
after insert on public.project_students
for each row execute function private.cancel_other_requests();

-- A student who leaves a project gives the theme back. Deleting a project does this too.
create function private.give_theme_back() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  theme uuid;
begin
  update public.theme_requests set status = 'cancelled'
  where student_id = old.student_id and status = 'accepted'
  returning theme_id into theme;

  update public.themes set status = 'open' where id = theme and status = 'taken';
  return null;
end;
$$;

create trigger give_theme_back
after delete on public.project_students
for each row execute function private.give_theme_back();

create function private.protect_requested_theme() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.theme_requests
    where theme_id = old.id and status in ('pending', 'accepted')
  ) then
    raise exception 'theme_has_requests';
  end if;
  return old;
end;
$$;

create trigger protect_requested_theme
before delete on public.themes
for each row execute function private.protect_requested_theme();

create or replace function private.check_role_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  stays_professor boolean := coalesce(new.role in ('supervisor', 'admin'), false);
begin
  if new.role is distinct from 'student' and (
    exists (select 1 from public.project_students where student_id = new.id)
    or exists (select 1 from public.themes where proposed_by = new.id)
    or exists (select 1 from public.theme_requests where student_id = new.id)
  ) then
    raise exception 'role_in_use';
  end if;

  if not stays_professor and (
    exists (select 1 from public.projects where supervisor_id = new.id)
    or exists (select 1 from public.jury_members where professor_id = new.id)
    or exists (select 1 from public.themes where professor_id = new.id)
  ) then
    raise exception 'role_in_use';
  end if;

  return new;
end;
$$;

-- Permissions ---------------------------------------------------------------------------

create function private.is_theme_professor(theme uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_professor() and exists (
    select 1 from public.themes where id = theme and professor_id = (select auth.uid())
  );
$$;

-- Themes that are no longer open stay visible to those who asked for them or work on them.
create function private.is_related_to_theme(theme uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select
    (private.is_active() and exists (
      select 1 from public.theme_requests
      where theme_id = theme and student_id = (select auth.uid())
    ))
    or exists (
      select 1 from public.projects where theme_id = theme and private.can_read_project(id)
    );
$$;

create policy "Related people read themes that are taken" on public.themes
for select to authenticated using (private.is_related_to_theme(id));

create or replace function private.can_read_proposer(student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_professor() and (
    exists (
      select 1 from public.themes
      where proposed_by = student and professor_id = (select auth.uid())
    )
    or exists (
      select 1 from public.theme_requests r
      join public.themes t on t.id = r.theme_id
      where r.student_id = student and t.professor_id = (select auth.uid())
    )
  );
$$;

alter table public.theme_requests enable row level security;
revoke all on public.theme_requests from anon, authenticated;
grant select, delete, insert (theme_id, message) on public.theme_requests to authenticated;

create policy "Students read their requests, professors those for their themes"
on public.theme_requests for select to authenticated
using (
  (select private.is_admin())
  or ((select private.is_active()) and student_id = (select auth.uid()))
  or private.is_theme_professor(theme_id)
);

create policy "Students ask for a theme" on public.theme_requests
for insert to authenticated
with check (
  (select private.current_user_role()) = 'student' and student_id = (select auth.uid())
);

create policy "Students withdraw requests without an answer" on public.theme_requests
for delete to authenticated
using (
  (select private.is_active()) and student_id = (select auth.uid()) and status = 'pending'
);

revoke execute on all functions in schema private from public, anon;
revoke execute on function public.answer_request(uuid, boolean, text) from public, anon;
grant execute on function
  private.is_theme_professor(uuid), private.is_related_to_theme(uuid)
to authenticated;
grant execute on function public.answer_request(uuid, boolean, text) to authenticated;
