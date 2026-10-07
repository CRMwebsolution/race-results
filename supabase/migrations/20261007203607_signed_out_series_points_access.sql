-- Spectator points policies reference this helper even for signed-out requests.
-- PostgreSQL checks EXECUTE permission when preparing the policy expression.
-- The helper requires a non-null auth.uid(), so anonymous callers receive false.
grant execute on function public.can_manage_competition(uuid) to anon;
