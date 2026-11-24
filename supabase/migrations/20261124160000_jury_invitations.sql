-- The students or the supervisor of a project invite professors to its jury. A professor's yes
-- becomes final when the admin confirms it: only then does it reach jury_members.
--
-- Functions lock the project first, so that two of them never change the same jury at once.

create type public.invitation_status as enum (
  'pending', 'accepted', 'refused', 'confirmed', 'cancelled'
);

create table public.jury_invitations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  professor_id uuid not null references public.profiles (id),
  jury_role public.jury_role not null,
  status public.invitation_status not null default 'pending',
  reply text check (char_length(reply) <= 1000),
  created_at timestamptz not null default now()
);

-- A refusal is final for that project.
create unique index one_invitation_per_professor
on public.jury_invitations (project_id, professor_id) where status <> 'cancelled';

create unique index one_invited_president
on public.jury_invitations (project_id)
where jury_role = 'president' and status in ('pending', 'accepted');

alter table public.settings add column jury_open boolean not null default false;
grant update (jury_open) on public.settings to authenticated;

-- Inviting ------------------------------------------------------------------------------

create function private.prepare_invitation() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  project public.projects;
  seats integer;
begin
  perform private.require_professor(new.professor_id);
  select * into project from public.projects where id = new.project_id for update;

  if project.supervisor_id = new.professor_id then
    raise exception 'supervisor_in_jury';
  end if;
  if project.status = 'defended' then
    raise exception 'project_defended';
  end if;

  -- Nobody is signed in: this is the seed script.
  if (select auth.uid()) is null then
    return new;
  end if;

  if not (select jury_open from public.settings) then
    raise exception 'jury_closed';
  end if;
  if exists (
    select 1 from public.jury_members
    where project_id = new.project_id and professor_id = new.professor_id
  ) then
    raise exception 'already_in_jury';
  end if;
  if new.jury_role = 'president' and exists (
    select 1 from public.jury_members
    where project_id = new.project_id and jury_role = 'president'
  ) then
    raise exception 'president_taken';
  end if;

  -- Four seats besides the supervisor, so that nobody invites the whole department.
  select
    (select count(*) from public.jury_members where project_id = new.project_id)
    + (select count(*) from public.jury_invitations
      where project_id = new.project_id and status in ('pending', 'accepted'))
  into seats;
  if seats >= 4 then
    raise exception 'jury_full';
  end if;
  return new;
end;
$$;

create trigger prepare_invitation
before insert on public.jury_invitations
for each row execute function private.prepare_invitation();

-- Answering and confirming --------------------------------------------------------------

create function public.answer_invitation(
  invitation uuid, accepted boolean, reason text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  current public.jury_invitations;
begin
  perform 1 from public.projects
  where id = (select project_id from public.jury_invitations where id = invitation)
  for update;
  -- The team withdraws by deleting this row, which does not lock the project.
  select * into current from public.jury_invitations where id = invitation for update;

  if not private.is_professor() or current.professor_id is distinct from (select auth.uid()) then
    raise exception 'not_allowed';
  end if;
  if current.status <> 'pending' then
    raise exception 'invitation_already_answered';
  end if;
  if not accepted and coalesce(trim(reason), '') = '' then
    raise exception 'reason_required';
  end if;

  update public.jury_invitations
  set status = case when accepted then 'accepted' else 'refused' end::public.invitation_status,
    reply = case when accepted then null else reason end
  where id = invitation;
end;
$$;

create function public.confirm_jury(project uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'not_allowed';
  end if;
  perform 1 from public.projects where id = project for update;

  -- The trigger below then marks these invitations as confirmed.
  insert into public.jury_members (project_id, professor_id, jury_role)
  select project_id, professor_id, jury_role
  from public.jury_invitations
  where project_id = project and status = 'accepted';

  if not found then
    raise exception 'nothing_to_confirm';
  end if;
end;
$$;

-- Keeping invitations and juries in agreement ---------------------------------------------

-- Also when the admin chooses a member directly.
create function private.settle_invitations() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.jury_invitations set status = 'confirmed'
  where project_id = new.project_id and professor_id = new.professor_id
    and status in ('pending', 'accepted');

  if new.jury_role = 'president' then
    update public.jury_invitations set status = 'cancelled'
    where project_id = new.project_id and jury_role = 'president'
      and status in ('pending', 'accepted');
  end if;
  return null;
end;
$$;

create trigger settle_invitations
after insert on public.jury_members
for each row execute function private.settle_invitations();

create function private.forget_invitation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.jury_invitations set status = 'cancelled'
  where project_id = old.project_id and professor_id = old.professor_id
    and status = 'confirmed';
  return null;
end;
$$;

create trigger forget_invitation
after delete on public.jury_members
for each row execute function private.forget_invitation();

-- A past defense needs nobody else, and a new supervisor leaves the jury.
create function private.cancel_useless_invitations() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.jury_invitations set status = 'cancelled'
  where project_id = new.id and status in ('pending', 'accepted')
    and (new.status = 'defended' or professor_id = new.supervisor_id);
  return null;
end;
$$;

create trigger cancel_useless_invitations
after update of status, supervisor_id on public.projects
for each row execute function private.cancel_useless_invitations();

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
    or exists (
      select 1 from public.jury_invitations
      where professor_id = new.id and status in ('pending', 'accepted')
    )
  ) then
    raise exception 'role_in_use';
  end if;

  return new;
end;
$$;

-- Permissions ---------------------------------------------------------------------------

create function private.is_invited(project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_professor() and exists (
    select 1 from public.jury_invitations
    where project_id = project and professor_id = (select auth.uid())
      and status in ('pending', 'accepted')
  );
$$;

-- Invited professors read the project before they answer. The reports have their own rule,
-- which still requires a confirmed jury member.
create or replace function private.can_read_project(project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_admin()
    or private.is_project_student(project)
    or private.is_project_supervisor(project)
    or private.is_jury_member(project)
    or private.is_invited(project);
$$;

-- Only totals: they help to choose, without showing who sits where.
create function public.jury_loads()
returns table (professor_id uuid, confirmed integer, waiting integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_active() then
    raise exception 'not_allowed';
  end if;

  return query
    select p.id,
      (select count(*)::integer from public.jury_members m where m.professor_id = p.id),
      (select count(*)::integer from public.jury_invitations i
        where i.professor_id = p.id and i.status in ('pending', 'accepted'))
    from public.profiles p
    where p.role in ('supervisor', 'admin');
end;
$$;

alter table public.jury_invitations enable row level security;
revoke all on public.jury_invitations from anon, authenticated;
grant select, delete, insert (project_id, professor_id, jury_role)
on public.jury_invitations to authenticated;

create policy "The team, the professor and the admin read invitations"
on public.jury_invitations for select to authenticated
using (
  (select private.is_admin())
  or private.is_project_student(project_id)
  or private.is_project_supervisor(project_id)
  or ((select private.is_professor()) and professor_id = (select auth.uid()))
);

create policy "The students and the supervisor invite" on public.jury_invitations
for insert to authenticated
with check (
  private.is_project_student(project_id) or private.is_project_supervisor(project_id)
);

create policy "The team withdraws unanswered invitations, the admin any open one"
on public.jury_invitations for delete to authenticated
using (
  ((select private.is_admin()) and status in ('pending', 'accepted', 'refused'))
  or (
    status = 'pending'
    and (private.is_project_student(project_id) or private.is_project_supervisor(project_id))
  )
);

revoke execute on all functions in schema private from public, anon;
revoke execute on function
  public.answer_invitation(uuid, boolean, text), public.confirm_jury(uuid), public.jury_loads()
from public, anon;
grant execute on function private.is_invited(uuid) to authenticated;
grant execute on function
  public.answer_invitation(uuid, boolean, text), public.confirm_jury(uuid), public.jury_loads()
to authenticated;
