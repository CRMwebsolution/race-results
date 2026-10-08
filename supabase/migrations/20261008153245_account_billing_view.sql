create or replace function public.billing_overview(p_org_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_plan record;v_scope uuid;v_credits integer;v_orgs jsonb;
begin
 if not public.is_org_admin(p_org_id) and not public.is_platform_admin() then raise exception 'Account management access required' using errcode='42501'; end if;
 v_scope:=billing_private.scope(p_org_id);
 select active_tier,subscription_end_date,limits_exempt into v_plan from public.organizations where id in(select billing_private.org_ids(p_org_id))
 order by limits_exempt desc,case when active_tier in('standard','premium') and subscription_end_date>now() then case active_tier when 'premium' then 3 else 2 end else 1 end desc,subscription_end_date desc nulls last limit 1;
 select sum(event_quota),jsonb_agg(jsonb_build_object('id',id,'name',name)) into v_credits,v_orgs from public.organizations where id in(select billing_private.org_ids(p_org_id));
 return jsonb_build_object('scope',v_scope,'active_tier',v_plan.active_tier,'subscription_end_date',v_plan.subscription_end_date,'limits_exempt',v_plan.limits_exempt,'remaining_credits',v_credits,'organizations',v_orgs);
end $$;
revoke all on function public.billing_overview(uuid) from public,anon;
grant execute on function public.billing_overview(uuid) to authenticated;
