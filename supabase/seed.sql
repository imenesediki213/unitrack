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
  ('student13', 'Nour Bensalem'),
  ('student14', 'Yanis Khelifi'),
  ('student15', 'Maya Cherif'),
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
  from generate_series(1, 15) as number
);

-- The status is written directly because PDF files cannot be created from SQL.
-- Projects 11 and 12 are left in progress to try the report workflow, and the jury of
-- project 12 is still being invited.
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
select md5('project' || number)::uuid, md5(president)::uuid, 'president'::public.jury_role
from demo where number <> 12
union all
select md5('project' || number)::uuid, md5(examiner)::uuid, 'examiner'
from demo where number <> 12;

insert into public.jury_invitations (project_id, professor_id, jury_role, status, reply) values
  (md5('project12')::uuid, md5('yacine')::uuid, 'president', 'accepted', null),
  (md5('project12')::uuid, md5('omar')::uuid, 'examiner', 'pending', null),
  (md5('project12')::uuid, md5('sofia')::uuid, 'examiner', 'refused',
    'Je serai en mission pendant les soutenances.');

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

-- Students 13 to 15 have no project yet: they can choose a theme or propose one.
update public.settings
set themes_open = true, jury_open = true, report_deadline = '2027-05-31 23:59:59+01';

insert into public.themes (title, description, professor_id, proposed_by, capacity, status, refusal_reason)
select title, description, md5(professor)::uuid, md5(student)::uuid, capacity,
  status::public.theme_status, reason
from (values
  ('Tableau de bord énergétique d’un campus',
   'Collecter les relevés des compteurs d’un bâtiment, les stocker et afficher les consommations anormales.',
   'karim', null, 2, 'open', null),
  ('Détection de fuites mémoire dans une application web',
   'Étudier les outils de profilage, puis écrire un outil qui repère les fuites les plus courantes.',
   'karim', null, 1, 'open', null),
  ('Recommandation de cours pour étudiants',
   'Comparer deux méthodes de recommandation sur un jeu de données public et présenter les résultats.',
   'lina', null, 1, 'open', null),
  ('Synchronisation hors ligne d’une application mobile',
   'Concevoir une application qui reste utilisable sans réseau et résout les conflits au retour de la connexion.',
   'omar', null, 2, 'open', null),
  ('Analyse des performances de files de messages',
   'Mesurer le débit et la latence de deux systèmes de files de messages dans les mêmes conditions.',
   'amel', null, 1, 'pending', null),
  ('Plateforme universelle d’apprentissage',
   'Créer une plateforme complète pour tous les cours de l’université.',
   'sofia', null, 2, 'refused', 'Le sujet est trop large : limitez-le à un seul type de cours.'),
  ('Carte collaborative des salles libres',
   'Les étudiants signalent les salles libres sur une carte, avec une vérification par le planning officiel.',
   'lina', 'student13', 1, 'proposed', null)
) as themes (title, description, professor, student, capacity, status, reason);

insert into public.theme_requests (theme_id, student_id, message, status, reply)
select t.id, md5(student)::uuid, message, r.status::public.request_status, reply
from (values
  ('Tableau de bord énergétique d’un campus', 'student15',
   'J’ai suivi le cours de bases de données et j’aimerais travailler sur des mesures réelles.',
   'pending', null),
  ('Recommandation de cours pour étudiants', 'student15',
   'Le sujet rejoint mon projet de troisième année.',
   'refused', 'Ce sujet demande un bon niveau en statistiques. Je vous conseille un autre thème.'),
  ('Tableau de bord énergétique d’un campus', 'student13',
   'Je voudrais apprendre à visualiser des données et je peux travailler en binôme.',
   'pending', null)
) as r (title, student, message, status, reply)
join public.themes t on t.title = r.title;

insert into public.messages (project_id, author_id, body, created_at) values
  (md5('project11')::uuid, md5('omar')::uuid,
    'Bonjour, où en êtes-vous de la collecte des journaux ?', now() - interval '3 days'),
  (md5('project11')::uuid, md5('student11')::uuid,
    'Bonjour, la collecte fonctionne. Dois-je garder les journaux de debug ?',
    now() - interval '2 days'),
  (md5('project12')::uuid, md5('admin')::uuid,
    'Pensez à inviter votre jury avant la fin du mois.', now() - interval '1 day');
