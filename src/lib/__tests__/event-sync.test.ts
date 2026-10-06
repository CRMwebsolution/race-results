import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { watchPublicEvent } from "../event-sync";

describe("Spectator update recovery", () => {
  let browser: EventTarget;
  let doc: EventTarget;
  beforeEach(() => {
    vi.useFakeTimers();
    browser = new EventTarget(); doc = new EventTarget();
    Object.assign(browser, { setInterval, clearInterval });
    Object.assign(doc, { visibilityState: "visible" });
    vi.stubGlobal("window",browser); vi.stubGlobal("document",doc);
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  function setup() {
    let changed: () => void = () => {};
    let status: (s: string) => void = () => {};
    const response = { data: { status: "live", published_revision: 1 } as {status:string;published_revision:number|null}|null, error: null };
    const fetch = vi.fn(async () => response);
    const channel = { on: vi.fn((_kind,_filter,fn) => { changed=fn; return channel; }), subscribe: vi.fn(fn => { status=fn; return channel; }) };
    const client = { channel: () => channel, removeChannel: vi.fn(), from: () => ({ select: () => ({ eq: () => ({ maybeSingle: fetch }) }) }) };
    const refresh=vi.fn(); const connection=vi.fn();
    const stop = watchPublicEvent(client as unknown as SupabaseClient<Database>,"event",() => ({status:"live",published_revision:1}),refresh,connection);
    return { changed: () => changed(), status: (s:string) => status(s), response, fetch, refresh, connection, stop, client };
  }
  it("recovers missed revisions and unpublished events through 15-second polling", async () => {
    const s=setup();
    await vi.advanceTimersByTimeAsync(15000);
    expect(s.refresh).not.toHaveBeenCalled();
    s.response.data={status:"live",published_revision:2};
    await vi.advanceTimersByTimeAsync(15000);
    expect(s.refresh).toHaveBeenCalledTimes(1);
    s.response.data=null;
    await vi.advanceTimersByTimeAsync(15000);
    expect(s.refresh).toHaveBeenCalledTimes(2);
    s.stop();
  });
  it("refreshes on subscription/reconnection, realtime changes, and return to the tab", async () => {
    const s=setup();
    s.status("CHANNEL_ERROR"); expect(s.connection).toHaveBeenLastCalledWith(false);
    s.status("SUBSCRIBED"); expect(s.connection).toHaveBeenLastCalledWith(true);
    s.changed(); browser.dispatchEvent(new Event("online")); browser.dispatchEvent(new Event("focus"));
    expect(s.refresh).toHaveBeenCalledTimes(4);
    await Promise.resolve();
    Object.assign(doc,{visibilityState:"hidden"});
    const calls=s.fetch.mock.calls.length;
    await vi.advanceTimersByTimeAsync(15000);
    expect(s.fetch).toHaveBeenCalledTimes(calls);
    Object.assign(doc,{visibilityState:"visible"}); doc.dispatchEvent(new Event("visibilitychange"));
    expect(s.fetch).toHaveBeenCalledTimes(calls+1);
    s.stop();
    s.changed(); s.status("SUBSCRIBED"); browser.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(30000);
    expect(s.refresh).toHaveBeenCalledTimes(4);
    expect(s.client.removeChannel).toHaveBeenCalledOnce();
  });
});
