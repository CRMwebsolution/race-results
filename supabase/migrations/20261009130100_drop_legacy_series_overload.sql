-- Drop legacy 4-argument overload to prevent Postgres RPC ambiguity
DROP FUNCTION IF EXISTS public.create_series_with_organization(text, text, uuid, text);
