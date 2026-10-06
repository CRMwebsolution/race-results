-- Enable realtime for the events table so spectators get live updates
alter publication supabase_realtime add table public.events;
