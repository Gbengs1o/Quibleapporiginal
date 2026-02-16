-- Migration 47: Add User Roles and Assign David as Admin

-- 1. Create a custom enum for user roles if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('user', 'rider', 'restaurant', 'admin');
    END IF;
END $$;

-- 2. Add role column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role public.user_role DEFAULT 'user';

-- 3. Update handle_new_user to include default role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  full_name text;
  first_name text;
  last_name text;
  avatar_url text;
  space_pos int;
BEGIN
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
    if new.raw_user_meta_data->>'first_name' is not null then
       first_name := new.raw_user_meta_data->>'first_name';
    end if;
    if new.raw_user_meta_data->>'last_name' is not null then
       last_name := new.raw_user_meta_data->>'last_name';
    end if;
  end if;

  -- Insert into public.profiles with default role
  insert into public.profiles (id, email, first_name, last_name, profile_picture_url, role)
  values (
    new.id,
    new.email,
    first_name,
    last_name,
    avatar_url,
    'user'
  )
  on conflict (id) do update set
    email = excluded.email,
    first_name = case when profiles.first_name is null or profiles.first_name = '' then excluded.first_name else profiles.first_name end,
    last_name = case when profiles.last_name is null or profiles.last_name = '' then excluded.last_name else profiles.last_name end,
    profile_picture_url = case when profiles.profile_picture_url is null then excluded.profile_picture_url else profiles.profile_picture_url end;

  return new;
END;
$$;

-- 4. Assign Admin role to David (davidogunkoya80@gmail.com)
UPDATE public.profiles
SET role = 'admin'
WHERE id = '930c5400-8e80-474b-af27-bf12ee26c601';
