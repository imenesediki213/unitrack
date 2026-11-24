-- Proves the permission rules by running queries as each kind of user.
-- The whole file runs in one transaction that is rolled back.

begin;
create extension if not exists pgtap with schema extensions;
select plan(181);

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
update public.settings
set schedule_published = false, themes_open = false, jury_open = false, report_deadline = null,
  results_published = false;

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

-- Themes: dan has no project, so he can propose ideas. ----------------------------------

reset role;
insert into auth.users (id, email, raw_user_meta_data)
select pg_temp.uid(name), name || '@example.test', json_build_object('full_name', name)
from unnest(array['dan', 'eve']) as name;
update public.profiles set role = 'student' where full_name in ('dan', 'eve');

create function pg_temp.add_theme(theme_title text, professor text) returns void
language sql as $$
  insert into public.themes (title, description, professor_id)
  values (theme_title, 'A description', pg_temp.uid(professor));
$$;

create function pg_temp.theme(theme_title text) returns uuid
language sql security definer as $$
  select id from public.themes where title = theme_title;
$$;

create function pg_temp.theme_status(theme_title text) returns text
language sql security definer as $$
  select status::text from public.themes where title = theme_title;
$$;

select pg_temp.login('sami');
select lives_ok($$select pg_temp.add_theme('Sami theme', 'sami')$$,
  'a professor proposes a theme');
select is(pg_temp.theme_status('Sami theme'), 'pending', 'it waits for the admin');
select throws_ok($$select pg_temp.add_theme('For salma', 'salma')$$, '42501', null,
  'a professor cannot add a theme for a colleague');
select throws_ok(
  $$insert into public.themes (title, description, professor_id, status)
    values ('Cheat', 'A description', pg_temp.uid('sami'), 'open')$$,
  '42501', null, 'nobody chooses the status of a theme');
select throws_ok($$select public.review_theme(pg_temp.theme('Sami theme'), true)$$,
  'P0001', 'not_allowed', 'a professor cannot approve their own theme');

select pg_temp.login('dan');
select is_empty('select 1 from public.themes', 'students do not see a theme before its approval');
select throws_ok($$select pg_temp.add_theme('Dan idea', 'salma')$$, 'P0001', 'themes_closed',
  'students propose nothing while the phase is closed');
update public.settings set themes_open = true;

select pg_temp.login('admin');
select is((select themes_open from public.settings), false, 'a student cannot open the phase');
update public.settings set themes_open = true;
select throws_ok($$select public.review_theme(pg_temp.theme('Sami theme'), false, ' ')$$,
  'P0001', 'reason_required', 'a refusal needs a reason');
select public.review_theme(pg_temp.theme('Sami theme'), false, 'Too wide');
select is(pg_temp.theme_status('Sami theme'), 'refused', 'the admin refuses a theme');

select pg_temp.login('sami');
update public.themes set title = 'Sami theme 2' where title = 'Sami theme';
select is(pg_temp.theme_status('Sami theme 2'), 'pending', 'editing a refused theme resubmits it');

select pg_temp.login('salma');
select is_empty($$select 1 from public.themes$$, 'a colleague does not see a pending theme');

select pg_temp.login('admin');
select public.review_theme(pg_temp.theme('Sami theme 2'), true);
select is(pg_temp.theme_status('Sami theme 2'), 'open', 'the admin approves a theme');
select throws_ok($$select public.review_theme(pg_temp.theme('Sami theme 2'), true)$$,
  'P0001', 'theme_already_reviewed', 'a theme is reviewed once');

select pg_temp.login('sami');
select throws_ok($$update public.themes set title = 'Other' where title = 'Sami theme 2'$$,
  'P0001', 'theme_locked', 'an approved theme cannot change');

select pg_temp.login('dan');
select results_eq('select title from public.themes', array['Sami theme 2'],
  'students see open themes');
select lives_ok($$select pg_temp.add_theme('Dan idea', 'salma')$$, 'a student proposes an idea');
select is(pg_temp.theme_status('Dan idea'), 'proposed', 'it waits for the professor');
select throws_ok($$select public.review_theme(pg_temp.theme('Dan idea'), true)$$,
  'P0001', 'not_allowed', 'a student cannot accept their own idea');

select pg_temp.login('alice');
select throws_ok($$select pg_temp.add_theme('Alice idea', 'salma')$$,
  'P0001', 'already_has_project', 'a student with a project cannot propose an idea');

select pg_temp.login('eve');
select is_empty($$select 1 from public.themes where title = 'Dan idea'$$,
  'a student does not see the ideas of others');

select pg_temp.login('sami');
select throws_ok($$select public.review_theme(pg_temp.theme('Dan idea'), true)$$,
  'P0001', 'not_allowed', 'another professor cannot accept the idea');

select pg_temp.login('salma');
select is((select full_name from public.profiles where id = pg_temp.uid('dan')), 'dan',
  'the professor sees who proposes the idea');
select public.review_theme(pg_temp.theme('Dan idea'), true);
select is(pg_temp.theme_status('Dan idea'), 'pending', 'an accepted idea goes to the admin');

select pg_temp.login('dan');
delete from public.themes;
select is(pg_temp.theme_status('Dan idea'), 'pending',
  'a student cannot withdraw an idea that was accepted');

-- Requests ------------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims', '', true);
create function pg_temp.ask(theme_title text) returns void language sql as $$
  insert into public.theme_requests (theme_id, message)
  values (pg_temp.theme(theme_title), 'I am interested in this');
$$;

create function pg_temp.request(student text, theme_title text) returns uuid
language sql security definer as $$
  select id from public.theme_requests
  where student_id = pg_temp.uid(student) and theme_id = pg_temp.theme(theme_title);
$$;

create function pg_temp.request_status(student text, theme_title text) returns text
language sql security definer as $$
  select status::text from public.theme_requests
  where student_id = pg_temp.uid(student) and theme_id = pg_temp.theme(theme_title);
$$;

-- What the database really contains, whatever the user can see.
create function pg_temp.project_of(student text) returns text
language sql security definer as $$
  select title from public.projects
  where id = (select project_id from public.project_students where student_id = pg_temp.uid(student));
$$;

insert into auth.users (id, email, raw_user_meta_data)
values (pg_temp.uid('fay'), 'fay@example.test', '{"full_name": "fay"}');
update public.profiles set role = 'student' where full_name = 'fay';

insert into public.themes (title, description, professor_id, capacity, status) values
  ('Single', 'A description', pg_temp.uid('sami'), 1, 'open'),
  ('Pair', 'A description', pg_temp.uid('salma'), 2, 'open'),
  ('Third', 'A description', pg_temp.uid('jury'), 1, 'open'),
  ('Fourth', 'A description', pg_temp.uid('jury'), 1, 'open');

select pg_temp.login('eve');
select lives_ok($$select pg_temp.ask('Single')$$, 'a student asks for a theme');
select throws_ok($$select pg_temp.ask('Single')$$, '23505', null, 'only once');
select throws_ok(
  $$insert into public.theme_requests (theme_id, student_id, message)
    values (pg_temp.theme('Pair'), pg_temp.uid('fay'), 'Instead of her')$$,
  '42501', null, 'a student cannot ask for someone else');
select throws_ok($$select pg_temp.ask('Dan idea')$$, 'P0001', 'theme_not_open',
  'a theme that is not open cannot be requested');
select pg_temp.ask('Pair');
select pg_temp.ask('Third');
select throws_ok($$select pg_temp.ask('Fourth')$$, 'P0001', 'too_many_requests',
  'three requests at most');
select throws_ok($$select pg_temp.add_theme('Eve idea', 'sami')$$, 'P0001', 'too_many_requests',
  'ideas count as requests');
delete from public.theme_requests where theme_id = pg_temp.theme('Third');
select is(pg_temp.request_status('eve', 'Third'), null, 'a student withdraws a request');
select throws_ok(
  $$select public.answer_request(pg_temp.request('eve', 'Single'), true)$$,
  'P0001', 'not_allowed', 'a student cannot accept their own request');

select pg_temp.login('alice');
select throws_ok($$select pg_temp.ask('Single')$$, 'P0001', 'already_has_project',
  'a student with a project asks for nothing');

select pg_temp.login('fay');
select is_empty('select 1 from public.theme_requests', 'a student does not see other requests');
select pg_temp.ask('Single');
select pg_temp.ask('Pair');

select pg_temp.login('salma');
select is((select count(*)::int from public.theme_requests), 2,
  'a professor sees the requests for their themes only');
select is((select full_name from public.profiles where id = pg_temp.uid('fay')), 'fay',
  'a professor sees who asks');
select throws_ok($$select public.answer_request(pg_temp.request('eve', 'Single'), true)$$,
  'P0001', 'not_allowed', 'another professor cannot answer');

select pg_temp.login('jury');
select is_empty($$select 1 from public.profiles where full_name = 'fay'$$,
  'the others do not');

select pg_temp.login('admin');
select throws_ok($$select public.answer_request(pg_temp.request('eve', 'Single'), true)$$,
  'P0001', 'not_allowed', 'the admin does not answer for a professor');

select pg_temp.login('sami');
select throws_ok(
  $$delete from public.themes where title = 'Single'$$,
  'P0001', 'theme_has_requests', 'a theme with requests cannot be withdrawn');
select throws_ok($$select public.answer_request(pg_temp.request('eve', 'Single'), false, '')$$,
  'P0001', 'reason_required', 'a refusal needs a reason');
select public.answer_request(pg_temp.request('eve', 'Single'), true);
select is(pg_temp.project_of('eve'), 'Single', 'accepting a request creates the project');
select is(pg_temp.request_status('eve', 'Pair'), 'cancelled',
  'the other requests of the student are cancelled');
select is(pg_temp.request_status('fay', 'Single'), 'cancelled',
  'the other requests for a full theme are cancelled');
select is(pg_temp.theme_status('Single'), 'taken', 'a full theme is taken');
select throws_ok($$select public.answer_request(pg_temp.request('fay', 'Single'), true)$$,
  'P0001', 'request_already_answered', 'a cancelled request cannot be accepted');

select pg_temp.login('eve');
select is((select status::text from public.themes where title = 'Single'), 'taken',
  'a student still sees the theme of their project');

select pg_temp.login('dan');
select is_empty($$select 1 from public.themes where title = 'Single'$$,
  'a taken theme leaves the catalogue');
select pg_temp.ask('Third');

select pg_temp.login('salma');
select throws_ok($$select public.answer_request(pg_temp.request('eve', 'Pair'), true)$$,
  'P0001', 'request_already_answered', 'a student has only one project');
select public.answer_request(pg_temp.request('fay', 'Pair'), true);
select is(pg_temp.theme_status('Pair'), 'open', 'a theme for two waits for the second student');

-- The idea that salma accepted above now gets its final approval.
select pg_temp.login('admin');
select public.review_theme(pg_temp.theme('Dan idea'), true);
select is(pg_temp.project_of('dan'), 'Dan idea', 'an approved idea goes to its author');
select is(pg_temp.request_status('dan', 'Third'), 'cancelled',
  'which cancels their other requests');

delete from public.project_students where student_id = pg_temp.uid('eve');
select is(pg_temp.theme_status('Single'), 'open', 'a student who leaves gives the theme back');

-- Jury invitations: fay works on "Pair", supervised by salma. -------------------------------

reset role;
select set_config('request.jwt.claims', '', true);
insert into auth.users (id, email, raw_user_meta_data)
select pg_temp.uid(name), name || '@example.test', json_build_object('full_name', name)
from unnest(array['prof1', 'prof2', 'prof3']) as name;
update public.profiles set role = 'supervisor' where full_name in ('prof1', 'prof2', 'prof3');

create function pg_temp.project(project_title text) returns uuid
language sql security definer as $$
  select id from public.projects where title = project_title;
$$;

create function pg_temp.invite(professor text, jury_role text) returns void language sql as $$
  insert into public.jury_invitations (project_id, professor_id, jury_role)
  values (pg_temp.project('Pair'), pg_temp.uid(professor), jury_role::public.jury_role);
$$;

create function pg_temp.invitation(professor text) returns uuid
language sql security definer as $$
  select id from public.jury_invitations
  where project_id = pg_temp.project('Pair') and professor_id = pg_temp.uid(professor)
    and status <> 'cancelled';
$$;

create function pg_temp.invitation_status(professor text) returns text
language sql security definer as $$
  select status::text from public.jury_invitations where id = pg_temp.invitation(professor);
$$;

create function pg_temp.pair_jury() returns text
language sql security definer as $$
  select string_agg(full_name || ' ' || jury_role, ', ' order by full_name)
  from public.jury_members join public.profiles on id = professor_id
  where project_id = pg_temp.project('Pair');
$$;

select pg_temp.login('fay');
select throws_ok($$select pg_temp.invite('prof1', 'president')$$, 'P0001', 'jury_closed',
  'nobody is invited while the phase is closed');
update public.settings set jury_open = true;

select pg_temp.login('admin');
select is((select jury_open from public.settings), false, 'a student cannot open the phase');
update public.settings set jury_open = true;

select pg_temp.login('prof1');
select is_empty($$select 1 from public.projects where title = 'Pair'$$,
  'a professor does not see the project before the invitation');

select pg_temp.login('alice');
select throws_ok($$select pg_temp.invite('prof1', 'president')$$, '42501', null,
  'a student cannot invite for another project');

select pg_temp.login('fay');
select lives_ok($$select pg_temp.invite('prof1', 'president')$$, 'a student invites a president');
select throws_ok($$select pg_temp.invite('prof2', 'president')$$, '23505', null,
  'one president at a time');
select throws_ok($$select pg_temp.invite('salma', 'examiner')$$, 'P0001', 'supervisor_in_jury',
  'the supervisor is not invited');
select throws_ok($$select pg_temp.invite('bob', 'examiner')$$, 'P0001', 'not_a_professor',
  'students are not invited');
select throws_ok(
  $$insert into public.jury_invitations (project_id, professor_id, jury_role, status)
    values (pg_temp.project('Pair'), pg_temp.uid('prof2'), 'examiner', 'accepted')$$,
  '42501', null, 'nobody answers in place of the professor');
select throws_ok($$select public.answer_invitation(pg_temp.invitation('prof1'), true)$$,
  'P0001', 'not_allowed', 'a student cannot accept for the professor');

select pg_temp.login('salma');
select lives_ok($$select pg_temp.invite('prof2', 'examiner')$$, 'the supervisor invites too');
select pg_temp.invite('prof3', 'examiner');
select pg_temp.invite('jury', 'examiner');
select throws_ok($$select pg_temp.invite('sami', 'examiner')$$, 'P0001', 'jury_full',
  'four invitations at most');

select pg_temp.login('fay');
delete from public.jury_invitations where professor_id = pg_temp.uid('jury');
select is(pg_temp.invitation_status('jury'), null, 'the team withdraws an invitation');

select pg_temp.login('prof1');
select results_eq('select title from public.projects', array['Pair'],
  'an invited professor reads the project');
select is((select full_name from public.profiles where id = pg_temp.uid('fay')), 'fay',
  'and the names of its students');
select is_empty('select 1 from public.report_versions', 'but not its reports');
select is((select count(*)::int from public.jury_invitations), 1,
  'a professor sees only their own invitations');
select public.answer_invitation(pg_temp.invitation('prof1'), true);
select is(pg_temp.invitation_status('prof1'), 'accepted', 'a professor accepts');
select throws_ok(
  $$select public.answer_invitation(pg_temp.invitation('prof1'), false, 'No')$$,
  'P0001', 'invitation_already_answered', 'an answer is final');
select throws_ok($$select public.confirm_jury(pg_temp.project('Pair'))$$,
  'P0001', 'not_allowed', 'a professor cannot confirm a jury');
select is(pg_temp.pair_jury(), null, 'accepting is not sitting yet');

select pg_temp.login('prof2');
select throws_ok($$select public.answer_invitation(pg_temp.invitation('prof2'), false)$$,
  'P0001', 'reason_required', 'a refusal needs a reason');
select public.answer_invitation(pg_temp.invitation('prof2'), false, 'Away in June');

select pg_temp.login('salma');
select throws_ok($$select pg_temp.invite('prof2', 'examiner')$$, '23505', null,
  'a refusal is final');
select throws_ok($$select public.confirm_jury(pg_temp.project('Pair'))$$,
  'P0001', 'not_allowed', 'a supervisor cannot confirm a jury');
delete from public.jury_invitations where professor_id = pg_temp.uid('prof1');
select is(pg_temp.invitation_status('prof1'), 'accepted',
  'the team cannot withdraw an accepted invitation');

select pg_temp.login('admin');
select throws_ok(
  $$update public.profiles set role = 'student' where id = pg_temp.uid('prof3')$$,
  'P0001', 'role_in_use', 'an invited professor keeps their role');
select is(
  (select confirmed || '/' || waiting from public.jury_loads()
    where professor_id = pg_temp.uid('prof1')),
  '0/1', 'the load counts what is waiting');
select public.confirm_jury(pg_temp.project('Pair'));
select is(pg_temp.pair_jury(), 'prof1 president', 'the admin confirms those who accepted');
select is(pg_temp.invitation_status('prof3'), 'pending', 'the others can still answer');
select throws_ok($$select public.confirm_jury(pg_temp.project('Pair'))$$,
  'P0001', 'nothing_to_confirm', 'nothing is confirmed twice');

insert into public.jury_members
values (pg_temp.project('Pair'), pg_temp.uid('prof3'), 'examiner');
select is(pg_temp.invitation_status('prof3'), 'confirmed',
  'a member chosen by the admin settles the invitation');
select is(
  (select confirmed || '/' || waiting from public.jury_loads()
    where professor_id = pg_temp.uid('prof1')),
  '1/0', 'the load counts confirmed juries');

select pg_temp.login('fay');
select throws_ok($$select pg_temp.invite('jury', 'president')$$, 'P0001', 'president_taken',
  'a second president cannot be invited');

select pg_temp.login('admin');
delete from public.jury_members where professor_id = pg_temp.uid('prof1');
select is(pg_temp.invitation_status('prof1'), null,
  'removing a member allows a new invitation');

-- Discussion: alice and sami on project 1, whose jury is "jury" and salma. -----------------

create function pg_temp.say(project text, body text) returns void language sql as $$
  insert into public.messages (project_id, body) values (pg_temp.uid(project), body);
$$;

select pg_temp.login('alice');
select lives_ok($$select pg_temp.say('p1', 'Hello')$$, 'a student writes to their supervisor');
select is((select author_id from public.messages), pg_temp.uid('alice'),
  'the author is recorded by the database');
select throws_ok($$select pg_temp.say('p2', 'Hello')$$, '42501', null,
  'a student cannot write in another project');
select throws_ok(
  $$insert into public.messages (project_id, author_id, body)
    values (pg_temp.uid('p1'), pg_temp.uid('sami'), 'You are the best')$$,
  '42501', null, 'nobody writes in the name of someone else');
select throws_ok($$select pg_temp.say('p1', '  ')$$, '23514', null, 'a message is not empty');
select throws_ok($$update public.messages set body = 'x'$$, '42501', null,
  'a message cannot be edited');
select throws_ok('delete from public.messages', '42501', null, 'a message cannot be deleted');
update public.settings set report_deadline = now();

select pg_temp.login('sami');
select is((select body from public.messages), 'Hello', 'the supervisor reads it');
select is((select author_id from public.last_messages), pg_temp.uid('alice'),
  'and sees who wrote last');

select pg_temp.login('salma');
select is_empty('select 1 from public.messages', 'the jury does not read the discussion');
select is_empty('select 1 from public.last_messages', 'not even through the view');

select pg_temp.login('bob');
select is_empty('select 1 from public.messages', 'other students do not either');

select pg_temp.login('admin');
select is_empty('select 1 from public.messages', 'nor does the admin');
select is((select report_deadline from public.settings), null,
  'a student cannot change the deadline');

-- Results: project 1 is defended, its president is "jury" and salma is an examiner. --------

create function pg_temp.enter_result(project text, mark numeric) returns void language sql as $$
  insert into public.results (project_id, mark) values (pg_temp.uid(project), mark);
$$;

select pg_temp.login('salma');
select throws_ok($$select pg_temp.enter_result('p1', 15)$$, '42501', null,
  'an examiner does not enter the result');
select pg_temp.login('sami');
select throws_ok($$select pg_temp.enter_result('p1', 15)$$, '42501', null,
  'nor does the supervisor');
select pg_temp.login('admin');
select throws_ok($$select pg_temp.enter_result('p1', 15)$$, '42501', null, 'nor does the admin');
select pg_temp.login('alice');
select throws_ok($$select pg_temp.enter_result('p1', 20)$$, '42501', null,
  'and certainly not the student');

select pg_temp.login('jury');
select throws_ok($$select pg_temp.enter_result('p1', 21)$$, '23514', null,
  'a mark is out of 20');
select lives_ok($$select pg_temp.enter_result('p1', 14)$$, 'the president enters the result');
update public.results set mark = 15;
select is((select mark from public.results), 15::numeric, 'and corrects it');

select pg_temp.login('salma');
update public.results set mark = 5;
select is((select mark from public.results), 15::numeric,
  'the rest of the jury reads it but cannot change it');

select pg_temp.login('alice');
select is_empty('select 1 from public.results', 'the student does not see it before publication');
update public.settings set results_published = true;

select pg_temp.login('admin');
select is((select results_published from public.settings), false,
  'a student cannot publish the results');
update public.settings set results_published = true;

select pg_temp.login('alice');
select is((select mark from public.results), 15::numeric, 'the student sees the published result');
select pg_temp.login('bob');
select is_empty('select 1 from public.results', 'other students do not');

select pg_temp.login('jury');
select throws_ok('update public.results set mark = 16', 'P0001', 'results_published',
  'a published result cannot change');

-- Visitors ------------------------------------------------------------------------------

select set_config('role', 'anon', true);
select throws_ok('select 1 from public.projects', '42501', null,
  'a visitor who is not signed in has no access');

select * from finish();
rollback;
