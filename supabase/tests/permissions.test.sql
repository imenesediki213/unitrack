-- Proves the permission rules by running queries as each kind of user.
-- The whole file runs in one transaction that is rolled back.

begin;
create extension if not exists pgtap with schema extensions;
select plan(66);

-- Helpers -------------------------------------------------------------------------------

create function pg_temp.uid(name text) returns uuid
language sql immutable as $$ select md5(name)::uuid $$;

-- What the API does for each request: takes the "authenticated" role and sets the JWT claims.
create function pg_temp.login(name text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid(name))::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create function pg_temp.upload(project text, file text) returns void
language sql as $$
  insert into storage.objects (bucket_id, name)
  values ('reports', pg_temp.uid(project) || '/' || file);
$$;

create function pg_temp.submit(project text, file text) returns void
language sql as $$
  insert into public.report_versions (project_id, file_path)
  values (pg_temp.uid(project), pg_temp.uid(project) || '/' || file);
$$;

-- The tests count rows, so they start without the demo data. The rollback brings it back.
truncate public.profiles, public.rooms, public.time_slots cascade;
delete from auth.users;
update public.settings set schedule_published = false;

-- Data: project 1 (alice, supervised by sami) and project 2 (bob, supervised by salma). ----

insert into auth.users (id, email, raw_user_meta_data)
select pg_temp.uid(name), name || '@example.test', json_build_object('full_name', name)
from unnest(array['admin', 'sami', 'salma', 'jury', 'alice', 'bob', 'newcomer']) as name;

insert into auth.users (id, email, raw_user_meta_data)
values (pg_temp.uid('cheater'), 'cheater@example.test',
  '{"full_name": "cheater", "role": "admin"}');

update public.profiles set role = 'admin' where full_name = 'admin';
update public.profiles set role = 'supervisor' where full_name in ('sami', 'salma', 'jury');
update public.profiles set role = 'student' where full_name in ('alice', 'bob');

insert into public.projects (id, title, supervisor_id) values
  (pg_temp.uid('p1'), 'Project one', pg_temp.uid('sami')),
  (pg_temp.uid('p2'), 'Project two', pg_temp.uid('salma'));
insert into public.project_students values
  (pg_temp.uid('p1'), pg_temp.uid('alice')),
  (pg_temp.uid('p2'), pg_temp.uid('bob'));
insert into public.jury_members values
  (pg_temp.uid('p1'), pg_temp.uid('jury'), 'president'),
  (pg_temp.uid('p1'), pg_temp.uid('salma'), 'examiner');

-- A project that the admin supervises, to test that rights follow the project.
insert into public.projects (id, title, supervisor_id)
values (pg_temp.uid('p3'), 'Project three', pg_temp.uid('admin'));

insert into public.rooms (id, name) values (pg_temp.uid('room'), 'Test room');
insert into public.time_slots (id, day, start_time, end_time) values
  (pg_temp.uid('slot1'), '2099-06-01', '09:00', '10:00'),
  (pg_temp.uid('slot2'), '2099-06-01', '10:00', '11:00');

-- Accounts ------------------------------------------------------------------------------

select is(
  (select role from public.profiles where id = pg_temp.uid('cheater')), null,
  'a role written in the sign-up data is ignored');

select pg_temp.login('newcomer');
select results_eq('select full_name from public.profiles', array['newcomer'],
  'an account without a role sees only itself');
select is_empty('select 1 from public.projects', 'an account without a role sees no project');
select is_empty('select 1 from public.rooms', 'an account without a role sees no room');
update public.profiles set role = 'admin' where id = pg_temp.uid('newcomer');
select is((select role from public.profiles where id = pg_temp.uid('newcomer')), null,
  'users cannot give themselves a role');

select pg_temp.login('alice');
select set_eq('select full_name from public.profiles',
  array['alice', 'admin', 'sami', 'salma', 'jury'],
  'a student sees professors but not other students');
select throws_ok('select * from public.list_accounts()', 'P0001', 'not_allowed',
  'a student cannot list accounts and emails');
select throws_ok($$update public.profiles set full_name = 'x'$$, '42501', null,
  'names cannot be changed through the API');

select pg_temp.login('sami');
select set_eq($$select full_name from public.profiles where role = 'student'$$, array['alice'],
  'a supervisor sees only the students of their projects');

select pg_temp.login('admin');
select lives_ok('select * from public.list_accounts()', 'the admin lists accounts');
select lives_ok(
  $$update public.profiles set role = 'student' where id = pg_temp.uid('newcomer')$$,
  'the admin gives a role');
select is((select role::text from public.profiles where id = pg_temp.uid('newcomer')), 'student',
  'the role was saved');
update public.profiles set role = null where id = pg_temp.uid('admin');
select is((select role::text from public.profiles where id = pg_temp.uid('admin')), 'admin',
  'the admin cannot remove their own role');
select throws_ok($$update public.profiles set role = 'student' where id = pg_temp.uid('sami')$$,
  'P0001', 'role_in_use', 'a supervisor with a project cannot become a student');

-- Projects ------------------------------------------------------------------------------

select pg_temp.login('alice');
select results_eq('select title from public.projects', array['Project one'],
  'a student sees only their project');
select throws_ok(
  $$insert into public.projects (title, supervisor_id) values ('Mine', pg_temp.uid('sami'))$$,
  '42501', null, 'a student cannot create a project');
select throws_ok($$update public.projects set status = 'approved'$$, '42501', null,
  'a student cannot change a status');
update public.projects set title = 'Hacked';
select results_eq('select title from public.projects', array['Project one'],
  'a student cannot rename a project');
select throws_ok(
  $$insert into public.project_students values (pg_temp.uid('p2'), pg_temp.uid('alice'))$$,
  '42501', null, 'a student cannot join another project');
select throws_ok(
  $$insert into public.jury_members
    values (pg_temp.uid('p1'), pg_temp.uid('admin'), 'examiner')$$,
  '42501', null, 'a student cannot choose their jury');

select pg_temp.login('bob');
select is_empty('select 1 from public.jury_members',
  'a student cannot read the jury of another project');

select pg_temp.login('admin');
select throws_ok($$update public.projects set status = 'approved'$$, '42501', null,
  'not even the admin can write a status directly');
select throws_ok(
  $$insert into public.jury_members values (pg_temp.uid('p1'), pg_temp.uid('sami'), 'examiner')$$,
  'P0001', 'supervisor_in_jury', 'the supervisor is not stored a second time in the jury');
select throws_ok(
  $$insert into public.jury_members values (pg_temp.uid('p1'), pg_temp.uid('bob'), 'examiner')$$,
  'P0001', 'not_a_professor', 'a student cannot sit on a jury');
select throws_ok(
  $$insert into public.jury_members values (pg_temp.uid('p1'), pg_temp.uid('admin'), 'president')$$,
  '23505', null, 'a jury has one president');

-- Report versions and files -------------------------------------------------------------

select pg_temp.login('alice');
select throws_ok($$select pg_temp.submit('p1', 'missing.pdf')$$, '42501', null,
  'a version needs an uploaded file');
select throws_ok($$select pg_temp.upload('p2', 'a.pdf')$$, '42501', null,
  'a student cannot upload to another project');
select lives_ok($$select pg_temp.upload('p1', 'v1.pdf')$$,
  'a student uploads to their project');
select throws_ok(
  $$insert into public.report_versions (project_id, file_path, decision)
    values (pg_temp.uid('p1'), pg_temp.uid('p1') || '/v1.pdf', 'approved')$$,
  '42501', null, 'a student cannot submit a version that is already approved');
select lives_ok($$select pg_temp.submit('p1', 'v1.pdf')$$, 'a student submits a version');
select is((select status::text from public.projects), 'submitted', 'the project is submitted');
select is((select uploaded_by from public.report_versions), pg_temp.uid('alice'),
  'the author is recorded by the database');
select throws_ok($$select pg_temp.upload('p1', 'v2.pdf')$$, '42501', null,
  'no upload while a version waits for its review');
update public.report_versions set decision = 'approved';
select is((select decision::text from public.report_versions), 'pending',
  'a student cannot approve their own report');

select pg_temp.login('bob');
select is_empty('select 1 from public.report_versions',
  'a student cannot read another student''s versions');
select is_empty($$select 1 from storage.objects where bucket_id = 'reports'$$,
  'a student cannot read another student''s file');

select pg_temp.login('salma');
select is_empty('select 1 from public.report_versions',
  'a jury member cannot read a version that is not approved');
select is_empty($$select 1 from storage.objects where bucket_id = 'reports'$$,
  'a jury member cannot read a file that is not approved');
update public.report_versions set decision = 'approved';

select pg_temp.login('admin');
update public.report_versions set decision = 'approved';

select pg_temp.login('sami');
select is((select decision::text from public.report_versions), 'pending',
  'only the supervisor reviews: neither the jury nor the admin could');
select throws_ok($$update public.report_versions set decision = 'changes_requested'$$,
  'P0001', 'comment_required', 'asking for changes requires a comment');
select throws_ok($$update public.report_versions set file_path = 'x'$$, '42501', null,
  'a supervisor cannot replace the file');
update public.report_versions set decision = 'changes_requested', comment = 'Add a conclusion';
select is((select status::text from public.projects where id = pg_temp.uid('p1')), 'in_progress',
  'asking for changes reopens the project');
select throws_ok($$update public.report_versions set decision = 'approved'$$,
  'P0001', 'already_reviewed', 'a review is final');

select pg_temp.login('alice');
select pg_temp.upload('p1', 'v2.pdf');
select pg_temp.submit('p1', 'v2.pdf');
select results_eq('select version_number from public.report_versions order by 1', array[1, 2],
  'versions are numbered and the history is kept');
select throws_ok('delete from public.report_versions', '42501', null,
  'versions cannot be deleted');

select pg_temp.login('sami');
update public.report_versions set decision = 'approved' where version_number = 2;
select is((select status::text from public.projects where id = pg_temp.uid('p1')), 'approved',
  'an approved version approves the project');

select pg_temp.login('salma');
select results_eq('select version_number from public.report_versions', array[2],
  'a jury member reads the approved version only');
select is((select count(*)::int from storage.objects where bucket_id = 'reports'), 1,
  'a jury member reads the approved file only');

-- Availability --------------------------------------------------------------------------

select lives_ok(
  $$insert into public.availability values (pg_temp.uid('salma'), pg_temp.uid('slot1'))$$,
  'a professor declares their availability');
select throws_ok(
  $$insert into public.availability values (pg_temp.uid('sami'), pg_temp.uid('slot1'))$$,
  '42501', null, 'a professor cannot declare it for someone else');

select pg_temp.login('sami');
select is_empty('select 1 from public.availability',
  'a professor does not see the availability of others');
select throws_ok(
  $$insert into public.time_slots (day, start_time, end_time)
    values ('2099-06-02', '09:00', '10:00')$$,
  '42501', null, 'a professor cannot create slots');
delete from public.rooms;
select is((select count(*)::int from public.rooms where name = 'Test room'), 1,
  'a professor cannot remove rooms');

select pg_temp.login('admin');
select lives_ok(
  $$insert into public.availability values (pg_temp.uid('jury'), pg_temp.uid('slot1'))$$,
  'the admin declares it for anyone');

-- Schedule ------------------------------------------------------------------------------

select throws_ok(
  $$insert into public.time_slots (day, start_time, end_time)
    values ('2099-06-01', '09:30', '10:30')$$,
  '23P01', null, 'slots cannot overlap');
select throws_ok(
  $$select public.save_schedule(json_build_array(json_build_object(
    'project_id', pg_temp.uid('p2'), 'slot_id', pg_temp.uid('slot1'),
    'room_id', pg_temp.uid('room')))::jsonb)$$,
  'P0001', 'project_not_approved', 'only approved projects are scheduled');

create function pg_temp.schedule_p1() returns void language sql as $$
  select public.save_schedule(json_build_array(json_build_object(
    'project_id', pg_temp.uid('p1'), 'slot_id', pg_temp.uid('slot1'),
    'room_id', pg_temp.uid('room')))::jsonb);
$$;

select lives_ok('select pg_temp.schedule_p1()', 'the admin saves the schedule');
select lives_ok('select pg_temp.schedule_p1()', 'saving again replaces it');

select pg_temp.login('alice');
select is_empty('select 1 from public.defenses', 'a draft schedule is hidden from students');
select throws_ok('select pg_temp.schedule_p1()', 'P0001', 'not_allowed',
  'a student cannot save a schedule');
update public.settings set schedule_published = true;

select pg_temp.login('admin');
select is((select schedule_published from public.settings), false,
  'a student cannot publish the schedule');
update public.settings set schedule_published = true;

select pg_temp.login('alice');
select is((select count(*)::int from public.defenses), 1,
  'a student sees their defense once the schedule is published');

select pg_temp.login('bob');
select is_empty('select 1 from public.defenses', 'a student does not see other defenses');

select pg_temp.login('admin');
select public.mark_defended(pg_temp.uid('p1'));
select public.save_schedule('[]');
select is((select count(*)::int from public.defenses), 1,
  'saving the schedule never removes a past defense');
select throws_ok(
  $$delete from public.jury_members where project_id = pg_temp.uid('p1')$$,
  'P0001', 'project_defended', 'the jury of a past defense cannot change');

-- Visitors ------------------------------------------------------------------------------

select set_config('role', 'anon', true);
select throws_ok('select 1 from public.projects', '42501', null,
  'a visitor who is not signed in has no access');

select * from finish();
rollback;
