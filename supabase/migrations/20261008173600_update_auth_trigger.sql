CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
INSERT INTO public.profiles (id, is_premium, tier, email, full_name, phone)
VALUES (
  new.id, 
  false, 
  'free', 
  new.email, 
  new.raw_user_meta_data->>'full_name', 
  new.raw_user_meta_data->>'phone'
)
ON CONFLICT (id) DO NOTHING;
RETURN new;
END;
$function$;
