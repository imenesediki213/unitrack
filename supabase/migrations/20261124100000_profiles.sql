-- Accounts and roles. A profile without a role has access to nothing.

create type public.user_role as enum ('student', 'supervisor', 'admin');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 100),
  role public.user_role
);

-- Helper functions for the policies. The schema is not exposed by the API.
-- They are "security definer" so that a policy can look at another protected table
-- without starting an endless chain of policies.
create schema private;
grant usage on schema private to authenticated;

create function private.current_user_role() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid());
$$;

create function private.is_active() returns boolean
language sql stable set search_path = '' as $$
  select private.current_user_role() is not null;
$$;

create function private.is_admin() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(private.current_user_role() = 'admin', false);
$$;

create function private.is_professor() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(private.current_user_role() in ('supervisor', 'admin'), false);
$$;

-- The head of department can also supervise and sit on juries.
create function private.require_professor(person uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.profiles where id = person and role in ('supervisor', 'admin')
  ) then
    raise exception 'not_a_professor';
  end if;
end;
$$;

-- The role never comes from the sign-up form: users control that data.
create function private.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
        split_part(new.email, '@', 1)
      ),
      100
    )
  );
  return new;
end;
$$;

create trigger create_profile
after insert on auth.users
for each row execute function private.create_profile();

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select, update (role) on public.profiles to authenticated;

create policy "Users read themselves, professors and, for admins, everyone"
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or (select private.is_admin())
  or ((select private.is_active()) and role in ('supervisor', 'admin'))
);

create policy "Admins set roles, except their own"
on public.profiles for update to authenticated
using ((select private.is_admin()) and id <> (select auth.uid()))
with check ((select private.is_admin()));

-- Emails stay in auth.users. Only admins need them, to recognise who signed up.
create function public.list_accounts()
returns table (id uuid, full_name text, email text, role public.user_role)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'not_allowed';
  end if;

  return query
    select p.id, p.full_name, u.email::text, p.role
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.full_name;
end;
$$;

revoke execute on all functions in schema private from public, anon;
revoke execute on function public.list_accounts() from public, anon;
grant execute on function
  private.current_user_role(), private.is_active(), private.is_admin(), private.is_professor()
to authenticated;
grant execute on function public.list_accounts() to authenticated;
