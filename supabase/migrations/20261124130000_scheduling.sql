-- Rooms, time slots, availability and the defense schedule.

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) between 1 and 60)
);

-- Slots are plain local dates and times: every defense happens in the same place.
create table public.time_slots (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  start_time time not null,
  end_time time not null,
  check (start_time < end_time),
  -- Without overlaps, "same slot" is the only way for two defenses to collide.
  constraint slots_do_not_overlap
    exclude using gist (tsrange(day + start_time, day + end_time) with &&)
);

-- A row means "available".
create table public.availability (
  professor_id uuid not null references public.profiles (id) on delete cascade,
  slot_id uuid not null references public.time_slots (id) on delete cascade,
  primary key (professor_id, slot_id)
);

create table public.defenses (
  project_id uuid primary key references public.projects (id),
  slot_id uuid not null references public.time_slots (id),
  room_id uuid not null references public.rooms (id),
  unique (slot_id, room_id)
);

-- A table limited to one row.
create table public.settings (
  id boolean primary key default true check (id),
  max_defenses_per_day integer not null default 3 check (max_defenses_per_day between 1 and 20),
  schedule_published boolean not null default false
);
insert into public.settings default values;

create function private.check_availability() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_professor(new.professor_id);
  return new;
end;
$$;

create trigger check_availability
before insert on public.availability
for each row execute function private.check_availability();

create function private.check_defense() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.projects where id = new.project_id and status = 'approved'
  ) then
    raise exception 'project_not_approved';
  end if;
  return new;
end;
$$;

create trigger check_defense
before insert on public.defenses
for each row execute function private.check_defense();

-- Past defenses keep the jury and the supervisor they had.
create function private.protect_defended() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  project uuid;
begin
  if tg_table_name = 'projects' then
    project := old.id;
  elsif tg_op = 'DELETE' then
    project := old.project_id;
  else
    project := new.project_id;
  end if;

  if exists (select 1 from public.projects where id = project and status = 'defended') then
    raise exception 'project_defended';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger protect_defended_jury
before insert or delete on public.jury_members
for each row execute function private.protect_defended();

create trigger protect_defended_project
before update of title, supervisor_id on public.projects
for each row execute function private.protect_defended();

create trigger protect_defended_schedule
before delete on public.defenses
for each row execute function private.protect_defended();

-- Replaces the schedule in one transaction. It runs with the caller's rights,
-- so the policies below still apply.
create function public.save_schedule(placements jsonb) returns void
language plpgsql set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'not_allowed';
  end if;

  delete from public.defenses
  where project_id in (select id from public.projects where status <> 'defended');

  insert into public.defenses (project_id, slot_id, room_id)
  select p.project_id, p.slot_id, p.room_id
  from jsonb_to_recordset(placements) as p (project_id uuid, slot_id uuid, room_id uuid);
end;
$$;

create function public.mark_defended(project uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'not_allowed';
  end if;
  if not exists (select 1 from public.defenses where project_id = project) then
    raise exception 'not_scheduled';
  end if;

  update public.projects set status = 'defended'
  where id = project and status = 'approved';
end;
$$;

alter table public.rooms enable row level security;
alter table public.time_slots enable row level security;
alter table public.availability enable row level security;
alter table public.defenses enable row level security;
alter table public.settings enable row level security;

revoke all on public.rooms, public.time_slots, public.availability, public.defenses,
  public.settings
from anon, authenticated;

grant select, insert, delete
on public.rooms, public.time_slots, public.availability, public.defenses to authenticated;
grant select, update (max_defenses_per_day, schedule_published)
on public.settings to authenticated;

create policy "Active users read rooms" on public.rooms for select to authenticated
using ((select private.is_active()));
create policy "Admins add rooms" on public.rooms for insert to authenticated
with check ((select private.is_admin()));
create policy "Admins remove rooms" on public.rooms for delete to authenticated
using ((select private.is_admin()));

create policy "Active users read slots" on public.time_slots for select to authenticated
using ((select private.is_active()));
create policy "Admins add slots" on public.time_slots for insert to authenticated
with check ((select private.is_admin()));
create policy "Admins remove slots" on public.time_slots for delete to authenticated
using ((select private.is_admin()));

create policy "Professors manage their availability, admins manage everyone's"
on public.availability for all to authenticated
using (
  (select private.is_admin())
  or (professor_id = (select auth.uid()) and (select private.is_professor()))
)
with check (
  (select private.is_admin())
  or (professor_id = (select auth.uid()) and (select private.is_professor()))
);

create policy "Active users read settings" on public.settings for select to authenticated
using ((select private.is_active()));
create policy "Admins edit settings" on public.settings for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "Admins read the schedule, others read their published defenses"
on public.defenses for select to authenticated
using (
  (select private.is_admin())
  or (
    (select schedule_published from public.settings)
    and private.can_read_project(project_id)
  )
);
create policy "Admins add defenses" on public.defenses for insert to authenticated
with check ((select private.is_admin()));
create policy "Admins remove defenses" on public.defenses for delete to authenticated
using ((select private.is_admin()));

revoke execute on all functions in schema private from public, anon;
revoke execute on function public.save_schedule(jsonb), public.mark_defended(uuid)
from public, anon;
grant execute on function public.save_schedule(jsonb), public.mark_defended(uuid)
to authenticated;
