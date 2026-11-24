-- Report versions and the private bucket that holds the PDFs.

create type public.review_decision as enum ('pending', 'approved', 'changes_requested');

create table public.report_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id),
  version_number integer not null,
  file_path text not null unique,
  uploaded_by uuid not null references public.profiles (id),
  uploaded_at timestamptz not null default now(),
  decision public.review_decision not null default 'pending',
  comment text check (char_length(comment) <= 4000),
  reviewed_at timestamptz,
  unique (project_id, version_number)
);

create unique index one_pending_version_per_project
on public.report_versions (project_id) where decision = 'pending';

-- Numbers the version and records its author, so that clients cannot choose them.
create function private.prepare_version() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  project_status public.project_status;
begin
  -- Locking the project makes two simultaneous uploads run one after the other.
  select status into project_status
  from public.projects where id = new.project_id for update;

  if project_status is distinct from 'in_progress' then
    raise exception 'project_not_in_progress';
  end if;

  select coalesce(max(version_number), 0) + 1 into new.version_number
  from public.report_versions where project_id = new.project_id;

  -- auth.uid() is null only for the seed script.
  new.uploaded_by := coalesce((select auth.uid()), new.uploaded_by);
  return new;
end;
$$;

create trigger prepare_version
before insert on public.report_versions
for each row execute function private.prepare_version();

create function private.mark_submitted() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.projects set status = 'submitted' where id = new.project_id;
  return null;
end;
$$;

create trigger mark_submitted
after insert on public.report_versions
for each row execute function private.mark_submitted();

create function private.check_review() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.decision <> 'pending' then
    raise exception 'already_reviewed';
  end if;
  if new.decision = 'changes_requested' and coalesce(trim(new.comment), '') = '' then
    raise exception 'comment_required';
  end if;
  if new.decision <> 'pending' then
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

create trigger check_review
before update on public.report_versions
for each row execute function private.check_review();

create function private.apply_review() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.decision = 'approved' then
    update public.projects set status = 'approved' where id = new.project_id;
  elsif new.decision = 'changes_requested' then
    update public.projects set status = 'in_progress' where id = new.project_id;
  end if;
  return null;
end;
$$;

create trigger apply_review
after update on public.report_versions
for each row execute function private.apply_review();

alter table public.report_versions enable row level security;
revoke all on public.report_versions from anon, authenticated;

-- RLS filters rows, not columns: these grants stop a supervisor from replacing a file.
-- Nobody can delete a version, so the history stays complete.
grant select, insert (project_id, file_path), update (decision, comment)
on public.report_versions to authenticated;

create policy "Team reads all versions, jury reads the approved one"
on public.report_versions for select to authenticated
using (
  (select private.is_admin())
  or private.is_project_student(project_id)
  or private.is_project_supervisor(project_id)
  or (decision = 'approved' and private.is_jury_member(project_id))
);

create policy "Students submit a file they uploaded to their project"
on public.report_versions for insert to authenticated
with check (
  private.is_project_student(project_id)
  and file_path like project_id || '/%'
  and exists (
    select 1 from storage.objects
    where bucket_id = 'reports' and name = file_path
  )
);

create policy "Supervisors review their projects"
on public.report_versions for update to authenticated
using (private.is_project_supervisor(project_id))
with check (private.is_project_supervisor(project_id));

-- Storage. A file is stored as "<project id>/<random id>.pdf".

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reports', 'reports', false, 20971520, array['application/pdf']);

create function private.project_of_file(file_name text) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.projects where id::text = split_part(file_name, '/', 1);
$$;

create function private.can_upload_report(file_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.projects
    where id = private.project_of_file(file_name)
      and status = 'in_progress'
      and private.is_project_student(id)
  );
$$;

create function private.can_read_report(file_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.projects p
    where p.id = private.project_of_file(file_name)
      and (
        private.is_admin()
        or private.is_project_student(p.id)
        or private.is_project_supervisor(p.id)
        or (
          private.is_jury_member(p.id)
          and exists (
            select 1 from public.report_versions v
            where v.file_path = file_name and v.decision = 'approved'
          )
        )
      )
  );
$$;

create policy "Students upload reports to their project"
on storage.objects for insert to authenticated
with check (bucket_id = 'reports' and private.can_upload_report(name));

create policy "Related people read reports"
on storage.objects for select to authenticated
using (bucket_id = 'reports' and private.can_read_report(name));

revoke execute on all functions in schema private from public, anon;
grant execute on function
  private.can_upload_report(text), private.can_read_report(text)
to authenticated;
