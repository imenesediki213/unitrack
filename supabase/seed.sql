-- Fictional demo data for local development. Every account uses the password "unitrack-demo".
-- "supabase db reset" runs this file. Never run it on a hosted project.

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  md5(login)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  login || '@unitrack.test', extensions.crypt('unitrack-demo', extensions.gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}',
  jsonb_build_object('full_name', full_name),
  now(), now(), '', '', '', ''
from (values
  ('admin', 'Dr. Nadia Rahal'),
  ('karim', 'Dr. Karim Belkadi'),
  ('lina', 'Dr. Lina Haddad'),
  ('yacine', 'Dr. Yacine Merabet'),
  ('sofia', 'Dr. Sofia Ziani'),
  ('omar', 'Dr. Omar Tebbal'),
  ('amel', 'Dr. Amel Kaci'),
  ('student01', 'Rania Saadi'),
  ('student02', 'Ilyes Mansour'),
  ('student03', 'Meriem Attal'),
  ('student04', 'Walid Chaoui'),
  ('student05', 'Sara Benali'),
  ('student06', 'Anis Guerfi'),
  ('student07', 'Lydia Oukil'),
  ('student08', 'Nassim Hamdi'),
  ('student09', 'Yasmine Ferhat'),
  ('student10', 'Adel Slimani'),
  ('student11', 'Kenza Moussaoui'),
  ('student12', 'Rayan Toumi'),
  ('newcomer', 'Ines Larbi')
) as accounts (login, full_name);

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), id, id::text, 'email',
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
  now(), now(), now()
from auth.users where email like '%@unitrack.test';

update public.profiles set role = 'admin' where id = md5('admin')::uuid;
update public.profiles set role = 'supervisor'
where id in (
  select md5(login)::uuid
  from unnest(array['karim', 'lina', 'yacine', 'sofia', 'omar', 'amel']) as login
);
update public.profiles set role = 'student'
where id in (
  select md5('student' || lpad(number::text, 2, '0'))::uuid
  from generate_series(1, 12) as number
);

-- The status is written directly because PDF files cannot be created from SQL.
-- Projects 11 and 12 are left in progress to try the report workflow.
create temporary table demo (
  number int, title text, supervisor text, president text, examiner text, status text
);
insert into demo values
  (1, 'Détection d’intrusions dans un réseau local', 'karim', 'lina', 'omar', 'approved'),
  (2, 'Réplication de données entre microservices', 'karim', 'yacine', 'amel', 'approved'),
  (3, 'Application mobile de covoiturage universitaire', 'lina', 'karim', 'sofia', 'approved'),
  (4, 'Équilibrage de charge avec SDN', 'lina', 'omar', 'yacine', 'approved'),
  (5, 'Reconnaissance de plantes par apprentissage profond', 'yacine', 'sofia', 'amel', 'approved'),
  (6, 'Plateforme de prise de rendez-vous médicaux', 'yacine', 'lina', 'karim', 'approved'),
  (7, 'Supervision d’un parc de capteurs agricoles', 'sofia', 'amel', 'omar', 'approved'),
  (8, 'Moteur de recherche pour archives scannées', 'sofia', 'yacine', 'lina', 'approved'),
  (9, 'Chiffrement de bout en bout pour messagerie', 'omar', 'karim', 'amel', 'approved'),
  (10, 'Ordonnancement de tâches dans un cluster', 'amel', 'sofia', 'karim', 'approved'),
  (11, 'Analyse de journaux système', 'omar', 'lina', 'sofia', 'in_progress'),
  (12, 'Gestion de bibliothèque pour un département', 'admin', 'yacine', 'omar', 'in_progress');

insert into public.projects (id, title, supervisor_id, status)
select md5('project' || number)::uuid, title, md5(supervisor)::uuid, status::public.project_status
from demo;

insert into public.project_students (project_id, student_id)
select md5('project' || number)::uuid, md5('student' || lpad(number::text, 2, '0'))::uuid
from demo;

insert into public.jury_members (project_id, professor_id, jury_role)
select md5('project' || number)::uuid, md5(president)::uuid, 'president'::public.jury_role from demo
union all
select md5('project' || number)::uuid, md5(examiner)::uuid, 'examiner' from demo;

drop table demo;

insert into public.rooms (name) values ('Amphi A'), ('Salle 12'), ('Salle 14');

insert into public.time_slots (day, start_time, end_time)
select day, start_time, start_time + interval '1 hour'
from unnest(array['2027-06-14', '2027-06-15', '2027-06-16']::date[]) as day,
  unnest(array['09:00', '10:15', '11:30', '14:00']::time[]) as start_time;

-- Everyone is available except for one half-day or day each.
insert into public.availability (professor_id, slot_id)
select p.id, s.id
from public.profiles p
cross join public.time_slots s
where p.role in ('supervisor', 'admin')
  and not (p.id = md5('karim')::uuid and s.day = '2027-06-16')
  and not (p.id = md5('lina')::uuid and s.day = '2027-06-14' and s.start_time < '11:00')
  and not (p.id = md5('yacine')::uuid and s.start_time = '14:00')
  and not (p.id = md5('omar')::uuid and s.day = '2027-06-15')
  and not (p.id = md5('amel')::uuid and s.start_time = '09:00');
