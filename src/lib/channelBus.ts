// Realtime transport over Lovable Cloud broadcast channels.
// Only encrypted blobs and public presence metadata cross the wire — the AES
// key never leaves the inviter's tab (it lives in the URL fragment of the
// invite link). This replaces the previous BroadcastChannel implementation,
// which only worked between tabs of the same browser.

import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type WireEvent =
  | { t: "msg"; iv: string; ct: string; from: string; at: number; id: string }
  | { t: "join"; name: string; at: number }
  | { t: "leave"; name: string; at: number }
  | { t: "presence-ping"; name: string }
  | { t: "presence-pong"; name: string };

type Handler = (e: WireEvent) => void;

export class ChannelBus {
  private channel: RealtimeChannel;
  private handlers = new Set<Handler>();
  private ready: Promise<void>;
  private queue: WireEvent[] = [];
  private closed = false;

  constructor(channelId: string) {
    const topic = `n1ckar-grid-${channelId}`;
    this.channel = supabase.channel(topic, {
      config: { broadcast: { self: false, ack: false } },
    });

    this.channel.on("broadcast", { event: "wire" }, (payload) => {
      const data = (payload as { payload?: WireEvent }).payload;
      if (!data) return;
      for (const h of this.handlers) h(data);
    });

    this.ready = new Promise<void>((resolve) => {
      this.channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          resolve();
          // flush anything queued before we connected
          const q = this.queue;
          this.queue = [];
          for (const e of q) this.send(e);
        }
      });
    });
  }

  on(h: Handler) {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }

  send(e: WireEvent) {
    if (this.closed) return;
    // Fire-and-forget; if not subscribed yet, queue.
    this.channel
      .send({ type: "broadcast", event: "wire", payload: e })
      .then((result) => {
        if (result !== "ok") this.queue.push(e);
      })
      .catch(() => {
        this.queue.push(e);
      });
  }

  close() {
    this.closed = true;
    this.handlers.clear();
    void supabase.removeChannel(this.channel);
  }
}
