// Per-channel BroadcastChannel transport. Encrypted blobs only; key never leaves the tab.
// Works cross-tab on the same browser. For cross-device, the same invite link
// reconstructs the same channel id + key.

export type WireEvent =
  | { t: "msg"; iv: string; ct: string; from: string; at: number; id: string }
  | { t: "join"; name: string; at: number }
  | { t: "leave"; name: string; at: number }
  | { t: "presence-ping"; name: string }
  | { t: "presence-pong"; name: string };

type Handler = (e: WireEvent) => void;

export class ChannelBus {
  private bc: BroadcastChannel;
  private handlers = new Set<Handler>();
  constructor(channelId: string) {
    this.bc = new BroadcastChannel(`n1ckar:${channelId}`);
    this.bc.onmessage = (ev) => {
      for (const h of this.handlers) h(ev.data as WireEvent);
    };
  }
  on(h: Handler) {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }
  send(e: WireEvent) {
    this.bc.postMessage(e);
  }
  close() {
    this.handlers.clear();
    this.bc.close();
  }
}
