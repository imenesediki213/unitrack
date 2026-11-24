-- Projects, their students and their juries.

create type public.project_status as enum ('in_progress', 'submitted', 'approved', 'defended');
create type public.jury_role as enum ('president', 'examiner');

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 3 and 200),
  supervisor_id uuid not null references public.profiles (id),
  status public.project_status not null default 'in_progress',
  created_at timestamptz not null default now()
);

create table public.project_students (
  project_id uuid not null references public.projects (id) on delete cascade,
  student_id uuid not null unique references public.profiles (id),
  primary key (project_id, student_id)
);

-- The supervisor also sits on the jury, but is already stored on the project.
create table public.jury_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  professor_id uuid not null references public.profiles (id),
  jury_role public.jury_role not null,
  primary key (project_id, professor_id)
);

create unique index one_president_per_jury
on public.jury_members (project_id) where jury_role = 'president';

-- Integrity rules that involve several tables.

create function private.check_supervisor() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_professor(new.supervisor_id);
  if exists (
    select 1 from public.jury_members
    where project_id = new.id and professor_id = new.supervisor_id
  ) then
    raise exception 'supervisor_in_jury';
  end if;
  return new;
end;
$$;

create trigger check_supervisor
before insert or update of supervisor_id on public.projects
for each row execute function private.check_supervisor();

create function private.check_student() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.profiles where id = new.student_id and role = 'student'
  ) then
    raise exception 'not_a_student';
  end if;
  return new;
end;
$$;

create trigger check_student
before insert on public.project_students
for each row execute function private.check_student();

create function private.check_jury_member() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_professor(new.professor_id);
  if exists (
    select 1 from public.projects
    where id = new.project_id and supervisor_id = new.professor_id
  ) then
    raise exception 'supervisor_in_jury';
  end if;
  return new;
end;
$$;

create trigger check_jury_member
before insert on public.jury_members
for each row execute function private.check_jury_member();

-- Changing the role of someone who has duties would leave, say, a student on a jury.
-- Moving between supervisor and admin is harmless: both are professors.
create function private.check_role_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  stays_professor boolean := coalesce(new.role in ('supervisor', 'admin'), false);
begin
  if new.role is distinct from 'student'
    and exists (select 1 from public.project_students where student_id = new.id)
  then
    raise exception 'role_in_use';
  end if;

  if not stays_professor and (
    exists (select 1 from public.projects where supervisor_id = new.id)
    or exists (select 1 from public.jury_members where professor_id = new.id)
  ) then
    raise exception 'role_in_use';
  end if;

  return new;
end;
$$;

create trigger check_role_change
before update of role on public.profiles
for each row execute function private.check_role_change();

-- Who is related to a project. Each one is false for an account without a role.

create function private.is_project_student(project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_active() and exists (
    select 1 from public.project_students
    where project_id = project and student_id = (select auth.uid())
  );
$$;

create function private.is_project_supervisor(project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_active() and exists (
    select 1 from public.projects
    where id = project and supervisor_id = (select auth.uid())
  );
$$;

create function private.is_jury_member(project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_active() and exists (
    select 1 from public.jury_members
    where project_id = project and professor_id = (select auth.uid())
  );
$$;

create function private.can_read_project(project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_admin()
    or private.is_project_student(project)
    or private.is_project_supervisor(project)
    or private.is_jury_member(project);
$$;

create function private.can_read_student(student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.project_students
    where student_id = student and private.can_read_project(project_id)
  );
$$;

alter table public.projects enable row level security;
alter table public.project_students enable row level security;
alter table public.jury_members enable row level security;

revoke all on public.projects, public.project_students, public.jury_members
from anon, authenticated;

-- "status" is left out on purpose: only triggers and mark_defended() change it.
grant select, delete, insert (title, supervisor_id), update (title, supervisor_id)
on public.projects to authenticated;
grant select, insert, delete on public.project_students to authenticated;
grant select, insert, delete on public.jury_members to authenticated;

create policy "People related to a project see its students"
on public.profiles for select to authenticated
using (private.can_read_student(id));

create policy "Related people read projects" on public.projects for select to authenticated
using (private.can_read_project(id));
create policy "Admins create projects" on public.projects for insert to authenticated
with check ((select private.is_admin()));
create policy "Admins edit projects" on public.projects for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins delete projects" on public.projects for delete to authenticated
using ((select private.is_admin()));

create policy "Related people read students" on public.project_students
for select to authenticated using (private.can_read_project(project_id));
create policy "Admins add students" on public.project_students
for insert to authenticated with check ((select private.is_admin()));
create policy "Admins remove students" on public.project_students
for delete to authenticated using ((select private.is_admin()));

create policy "Related people read juries" on public.jury_members
for select to authenticated using (private.can_read_project(project_id));
create policy "Admins add jury members" on public.jury_members
for insert to authenticated with check ((select private.is_admin()));
create policy "Admins remove jury members" on public.jury_members
for delete to authenticated using ((select private.is_admin()));

revoke execute on all functions in schema private from public, anon;
grant execute on function
  private.is_project_student(uuid), private.is_project_supervisor(uuid),
  private.is_jury_member(uuid), private.can_read_project(uuid), private.can_read_student(uuid)
to authenticated;
