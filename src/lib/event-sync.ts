import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type PublicState = { status: string; published_revision: number | null };

/** Realtime is a signal, with polling and browser recovery to repair missed delivery. */
export function watchPublicEvent(
  client: SupabaseClient<Database>, eventId: string,
  current: () => PublicState, refresh: () => void, connection: (connected: boolean) => void
) {
  let disposed = false;
  let checking = false;
  const check = async () => {
    if (disposed || checking || document.visibilityState === "hidden") return;
    checking = true;
    try {
      const { data, error } = await client.from("events").select("status,published_revision").eq("id",eventId).maybeSingle();
      if (disposed) return;
      if (error) { connection(false); return; }
      const previous = current();
      if (!data || data.status !== previous.status || data.published_revision !== previous.published_revision) refresh();
    } catch {
      if (!disposed) connection(false);
    } finally { checking = false; }
  };
  const recover = () => { if (!disposed) { refresh(); void check(); } };
  const channel = client.channel(`event-${eventId}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "events", filter: `id=eq.${eventId}` }, () => {
      if (!disposed) refresh();
    })
    .subscribe(status => {
      if (disposed) return;
      connection(status === "SUBSCRIBED");
      if (status === "SUBSCRIBED") recover();
    });
  const timer = window.setInterval(() => { void check(); },15000);
  window.addEventListener("online",recover);
  window.addEventListener("focus",recover);
  document.addEventListener("visibilitychange",check);
  return () => {
    disposed = true;
    window.clearInterval(timer);
    window.removeEventListener("online",recover);
    window.removeEventListener("focus",recover);
    document.removeEventListener("visibilitychange",check);
    void client.removeChannel(channel);
  };
}
