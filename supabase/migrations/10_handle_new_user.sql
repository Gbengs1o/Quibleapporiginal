-- Create a function that runs when a new user is created in auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  full_name text;
  first_name text;
  last_name text;
  avatar_url text;
  space_pos int;
begin
  -- Get metadata from the new user
  full_name := new.raw_user_meta_data->>'full_name';
  avatar_url := new.raw_user_meta_data->>'avatar_url';

  -- Default names if missing
  first_name := '';
  last_name := '';

  -- Split full_name into first and last name if present
  if full_name is not null and length(full_name) > 0 then
    space_pos := position(' ' in full_name);
    if space_pos > 0 then
      first_name := substring(full_name from 1 for space_pos - 1);
      last_name := substring(full_name from space_pos + 1);
    else
      first_name := full_name;
    end if;
  else
    -- Fallback: try separate fields or just use email part (optional, but let's keep it simple)
    if new.raw_user_meta_data->>'first_name' is not null then
       first_name := new.raw_user_meta_data->>'first_name';
    end if;
    if new.raw_user_meta_data->>'last_name' is not null then
       last_name := new.raw_user_meta_data->>'last_name';
    end if;
  end if;

  -- Insert into public.profiles
  insert into public.profiles (id, email, first_name, last_name, profile_picture_url)
  values (
    new.id,
    new.email,
    first_name,
    last_name,
    avatar_url -- Google provides this as 'avatar_url' or 'picture' usually mapped
  )
  on conflict (id) do update set
    email = excluded.email,
    first_name = case when profiles.first_name is null or profiles.first_name = '' then excluded.first_name else profiles.first_name end,
    last_name = case when profiles.last_name is null or profiles.last_name = '' then excluded.last_name else profiles.last_name end,
    profile_picture_url = case when profiles.profile_picture_url is null then excluded.profile_picture_url else profiles.profile_picture_url end;

  return new;
end;
$$;

-- Create the trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
