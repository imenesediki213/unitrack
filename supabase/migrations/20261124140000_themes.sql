-- Project themes: published by professors or proposed by students, approved by the admin.

-- proposed: a student's idea, waiting for the professor.
-- pending:  waiting for the admin.
-- open:     visible to every student.
create type public.theme_status as enum ('proposed', 'pending', 'open', 'refused');

create table public.themes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 3 and 200),
  description text not null check (char_length(trim(description)) between 10 and 2000),
  professor_id uuid not null references public.profiles (id),
  -- The student who had the idea. Null when it comes from a professor or the admin.
  proposed_by uuid references public.profiles (id),
  capacity integer not null default 1 check (capacity between 1 and 2),
  status public.theme_status not null default 'pending',
  refusal_reason text check (char_length(refusal_reason) <= 1000),
  created_at timestamptz not null default now()
);

-- Students can only act on themes while the admin keeps this phase open.
alter table public.settings add column themes_open boolean not null default false;
grant update (themes_open) on public.settings to authenticated;

-- The first status depends on the author, so that clients cannot choose it.
create function private.prepare_theme() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  author uuid := (select auth.uid());
begin
  perform private.require_professor(new.professor_id);

  -- Nobody is signed in: this is the seed script.
  if author is null then
    return new;
  end if;

  if private.is_admin() then
    new.status := 'open';
  elsif private.is_professor() then
    new.status := 'pending';
  else
    if not (select themes_open from public.settings) then
      raise exception 'themes_closed';
    end if;
    if exists (select 1 from public.project_students where student_id = author) then
      raise exception 'already_has_project';
    end if;
    new.status := 'proposed';
    new.proposed_by := author;
  end if;
  return new;
end;
$$;

create trigger prepare_theme
before insert on public.themes
for each row execute function private.prepare_theme();

-- The admin approved a precise text: once open, it no longer changes.
create function private.resubmit_edited_theme() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status not in ('pending', 'refused') then
    raise exception 'theme_locked';
  end if;
  new.status := 'pending';
  new.refusal_reason := null;
  return new;
end;
$$;

create trigger resubmit_edited_theme
before update of title, description, capacity on public.themes
for each row execute function private.resubmit_edited_theme();

-- A student's idea goes to the professor, then every theme goes to the admin.
create function public.review_theme(theme uuid, accepted boolean, reason text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  current public.themes;
  next_status public.theme_status;
begin
  -- The lock makes a second review wait, then see that the first one was done.
  select * into current from public.themes where id = theme for update;

  if current.status = 'proposed' then
    if not private.is_professor() or current.professor_id <> (select auth.uid()) then
      raise exception 'not_allowed';
    end if;
    -- The admin who accepts an idea has nobody else to ask.
    next_status := case when private.is_admin() then 'open' else 'pending' end;
  elsif not private.is_admin() then
    raise exception 'not_allowed';
  elsif current.status = 'pending' then
    next_status := 'open';
  else
    raise exception 'theme_already_reviewed';
  end if;

  if not accepted then
    if coalesce(trim(reason), '') = '' then
      raise exception 'reason_required';
    end if;
    next_status := 'refused';
  end if;

  update public.themes
  set status = next_status, refusal_reason = case when accepted then null else reason end
  where id = theme;
end;
$$;

-- A professor sees the name of the students who propose them an idea.
create function private.can_read_proposer(student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_professor() and exists (
    select 1 from public.themes
    where proposed_by = student and professor_id = (select auth.uid())
  );
$$;

create policy "Professors see the students who propose them a theme"
on public.profiles for select to authenticated
using (private.can_read_proposer(id));

-- Same rule as for projects: a person with themes keeps a role that allows them.
create or replace function private.check_role_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  stays_professor boolean := coalesce(new.role in ('supervisor', 'admin'), false);
begin
  if new.role is distinct from 'student' and (
    exists (select 1 from public.project_students where student_id = new.id)
    or exists (select 1 from public.themes where proposed_by = new.id)
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

alter table public.themes enable row level security;
revoke all on public.themes from anon, authenticated;

-- The status only changes through the triggers and review_theme().
grant select, delete, insert (title, description, professor_id, capacity),
  update (title, description, capacity)
on public.themes to authenticated;

create policy "Open themes are public, the others are for the people involved"
on public.themes for select to authenticated
using (
  (select private.is_admin())
  or ((select private.is_active()) and status = 'open')
  or ((select private.is_active()) and (select auth.uid()) in (professor_id, proposed_by))
);

create policy "Professors add their themes, students and admins choose the professor"
on public.themes for insert to authenticated
with check (
  (select private.current_user_role()) in ('student', 'admin')
  or ((select private.is_professor()) and professor_id = (select auth.uid()))
);

create policy "Professors edit their themes"
on public.themes for update to authenticated
using ((select private.is_professor()) and professor_id = (select auth.uid()))
with check ((select private.is_professor()) and professor_id = (select auth.uid()));

create policy "Authors withdraw their themes, admins remove any"
on public.themes for delete to authenticated
using (
  (select private.is_admin())
  or (
    (select private.is_professor())
    and professor_id = (select auth.uid())
    and proposed_by is null
  )
  or (
    (select private.is_active())
    and proposed_by = (select auth.uid())
    and status in ('proposed', 'refused')
  )
);

revoke execute on all functions in schema private from public, anon;
revoke execute on function public.review_theme(uuid, boolean, text) from public, anon;
grant execute on function private.can_read_proposer(uuid) to authenticated;
grant execute on function public.review_theme(uuid, boolean, text) to authenticated;
