CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  full_name text;
  first_name text;
  last_name text;
  avatar_url text;
  space_pos int;
  ref_code text;
  ref_by_id UUID;
  ref_by_code text;
BEGIN
  -- Get metadata from the new user
  full_name := new.raw_user_meta_data->>'full_name';
  avatar_url := new.raw_user_meta_data->>'avatar_url';
  ref_by_code := new.raw_user_meta_data->>'referred_by_code';

  -- Default names
  first_name := '';
  last_name := '';

  IF full_name IS NOT NULL AND LENGTH(full_name) > 0 THEN
    space_pos := POSITION(' ' IN full_name);
    IF space_pos > 0 THEN
      first_name := SUBSTRING(full_name FROM 1 FOR space_pos - 1);
      last_name := SUBSTRING(full_name FROM space_pos + 1);
    ELSE
      first_name := full_name;
    END IF;
  ELSE
    IF new.raw_user_meta_data->>'first_name' IS NOT NULL THEN
       first_name := new.raw_user_meta_data->>'first_name';
    END IF;
    IF new.raw_user_meta_data->>'last_name' IS NOT NULL THEN
       last_name := new.raw_user_meta_data->>'last_name';
    END IF;
  END IF;

  -- Resolve referral
  IF ref_by_code IS NOT NULL THEN
    SELECT id INTO ref_by_id FROM public.profiles WHERE referral_code = upper(ref_by_code);
  END IF;

  -- Generate new referral code for this user
  ref_code := public.generate_unique_referral_code();

  -- Insert profile
  INSERT INTO public.profiles (id, first_name, last_name, profile_picture_url, referral_code, referred_by_id)
  VALUES (new.id, first_name, last_name, avatar_url, ref_code, ref_by_id)
  ON CONFLICT (id) DO NOTHING;

  -- AUTO-CREATE PERSONAL WALLET
  INSERT INTO public.wallets (user_id, type, balance)
  VALUES (new.id, 'personal', 0)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;
