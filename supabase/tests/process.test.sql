-- One project from its theme to its mark, each step done by the person who does it in the app.
-- The whole file runs in one transaction that is rolled back.

begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

create function pg_temp.uid(name text) returns uuid
language sql immutable as $$ select md5('process-' || name)::uuid $$;

create function pg_temp.login(name text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid(name))::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

-- Ids are found as a superuser, like the app finds them in its own lists.
create function pg_temp.project() returns uuid language sql security definer as $$
  select id from public.projects where title = 'Process theme';
$$;

create function pg_temp.theme() returns uuid language sql security definer as $$
  select id from public.themes where title = 'Process theme';
$$;

create function pg_temp.request() returns uuid language sql security definer as $$
  select id from public.theme_requests where theme_id = pg_temp.theme();
$$;

create function pg_temp.invitation(professor text) returns uuid language sql security definer as $$
  select id from public.jury_invitations
  where project_id = pg_temp.project() and professor_id = pg_temp.uid(professor);
$$;

create function pg_temp.status() returns text language sql security definer as $$
  select status::text from public.projects where id = pg_temp.project();
$$;

create function pg_temp.submit(file text) returns void language sql as $$
  insert into storage.objects (bucket_id, name)
  values ('reports', pg_temp.project() || '/' || file);
  insert into public.report_versions (project_id, file_path)
  values (pg_temp.project(), pg_temp.project() || '/' || file);
$$;

create function pg_temp.schedule() returns void language sql as $$
  select public.save_schedule(jsonb_build_array(jsonb_build_object(
    'project_id', pg_temp.project(), 'slot_id', pg_temp.uid('slot'),
    'room_id', pg_temp.uid('room'))));
$$;

truncate public.profiles, public.rooms, public.time_slots cascade;
delete from auth.users;
update public.settings
set schedule_published = false, themes_open = false, jury_open = false, results_published = false;

insert into auth.users (id, email, raw_user_meta_data)
select pg_temp.uid(name), name || '@process.test', json_build_object('full_name', name)
from unnest(array['head', 'supervisor', 'president', 'examiner', 'student']) as name;
update public.profiles set role = 'admin' where full_name = 'head';

-- The head of department opens the year --------------------------------------------------

select pg_temp.login('head');
update public.profiles set role = 'supervisor'
where full_name in ('supervisor', 'president', 'examiner');
update public.profiles set role = 'student' where full_name = 'student';
update public.settings set themes_open = true, jury_open = true;
insert into public.rooms (id, name) values (pg_temp.uid('room'), 'Process room');
insert into public.time_slots (id, day, start_time, end_time)
values (pg_temp.uid('slot'), '2099-06-01', '09:00', '10:00');
select is((select count(*)::int from public.profiles where role is not null), 5,
  'the head gives the roles');

-- Theme and supervisor ------------------------------------------------------------------

select pg_temp.login('supervisor');
insert into public.themes (title, description, professor_id)
values ('Process theme', 'A description', pg_temp.uid('supervisor'));
select pg_temp.login('head');
select public.review_theme(pg_temp.theme(), true);

select pg_temp.login('student');
select lives_ok(
  $$insert into public.theme_requests (theme_id, message)
    values (pg_temp.theme(), 'I would like this theme')$$,
  'the student asks for the published theme');
select is_empty('select 1 from public.projects', 'and has no project yet');

select pg_temp.login('supervisor');
select public.answer_request(pg_temp.request(), true);
select is(pg_temp.status(), 'in_progress', 'the supervisor accepts: the project starts');

-- Jury ----------------------------------------------------------------------------------

select pg_temp.login('student');
insert into public.jury_invitations (project_id, professor_id, jury_role) values
  (pg_temp.project(), pg_temp.uid('president'), 'president'),
  (pg_temp.project(), pg_temp.uid('examiner'), 'examiner');
select pg_temp.login('president');
select public.answer_invitation(pg_temp.invitation('president'), true);
select pg_temp.login('examiner');
select public.answer_invitation(pg_temp.invitation('examiner'), true);
select pg_temp.login('head');
select public.confirm_jury(pg_temp.project());
select is((select count(*)::int from public.jury_members), 2, 'the jury is confirmed');

-- Report --------------------------------------------------------------------------------

select pg_temp.login('student');
insert into public.messages (project_id, body) values (pg_temp.project(), 'First version soon');
select pg_temp.submit('v1.pdf');
select is(pg_temp.status(), 'submitted', 'the student submits a report');

select pg_temp.login('supervisor');
update public.report_versions set decision = 'changes_requested', comment = 'Add a conclusion';
select is(pg_temp.status(), 'in_progress', 'the supervisor asks for changes');

select pg_temp.login('student');
select pg_temp.submit('v2.pdf');
select pg_temp.login('supervisor');
update public.report_versions set decision = 'approved' where version_number = 2;
select is(pg_temp.status(), 'approved', 'the second version is approved');

select pg_temp.login('examiner');
select results_eq('select version_number from public.report_versions', array[2],
  'the jury reads the approved version');

-- Defense -------------------------------------------------------------------------------

select pg_temp.login('head');
select lives_ok('select pg_temp.schedule()', 'the head schedules the defense');
select pg_temp.login('student');
select is_empty('select 1 from public.defenses', 'the student does not see the draft');
select pg_temp.login('head');
update public.settings set schedule_published = true;
select pg_temp.login('student');
select is((select count(*)::int from public.defenses), 1, 'the student sees the published date');

-- Result --------------------------------------------------------------------------------

select pg_temp.login('president');
select throws_ok(
  $$insert into public.results (project_id, mark) values (pg_temp.project(), 16)$$,
  'P0001', 'not_defended', 'there is no mark before the defense');

select pg_temp.login('head');
select public.mark_defended(pg_temp.project());
select pg_temp.login('president');
select lives_ok(
  $$insert into public.results (project_id, mark, remarks)
    values (pg_temp.project(), 16.5, 'Very good work')$$,
  'the president enters the mark');
select pg_temp.login('student');
select is_empty('select 1 from public.results', 'the student does not see it yet');
select pg_temp.login('head');
update public.settings set results_published = true;
select pg_temp.login('student');
select is((select mark from public.results), 16.5, 'the student reads the published mark');
select is(pg_temp.status(), 'defended', 'the project is finished');

select * from finish();
rollback;
