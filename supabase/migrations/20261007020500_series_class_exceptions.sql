-- Race class exceptions follow the independent owner, including touring series.
CREATE OR REPLACE FUNCTION public.create_event_class(p_event_id uuid, p_name text, p_type scoring_type, p_config jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e public.events; c uuid;
begin
 select * into e from public.events where id=p_event_id for update;
 if not found or auth.uid() is null or not public.can_manage_race(e.id) then raise exception 'Not authorized' using errcode='42501'; end if;
 if nullif(trim(p_name),'') is null then raise exception 'Class name is required'; end if;
 insert into public.event_classes(event_id,track_id,name,scoring_type,scoring_config,order_num) select e.id,e.track_id,trim(p_name),p_type,p_config,coalesce(max(order_num),0)+1 from public.event_classes where event_id=e.id returning id into c;
 return c;
end $function$;

notify pgrst,'reload schema';

