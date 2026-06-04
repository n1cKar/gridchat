import { useEffect, useMemo, useRef, useState } from "react";
import {
  Shield, Lock, Send, Phone, Video, Plus, Trash2, Copy, Check,
  Hash, Users, KeyRound, LogOut, Sparkles, Link2, Radio, Zap,
} from "lucide-react";
import { CallOverlay, type CallMode } from "./CallOverlay";
import {
  generateChannelKey, exportKeyB64, importKeyB64, fingerprint,
  encryptJson, decryptJson, randomId,
} from "@/lib/crypto";
import { ChannelBus, type WireEvent } from "@/lib/channelBus";

type Msg = { id: string; from: string; text: string; at: number; mine: boolean };

type ChannelState = {
  id: string;
  name: string;
  key: CryptoKey;
  keyB64: string;
  fp: string;
  myName: string;
  members: Map<string, number>; // name -> lastSeen ts
  messages: Msg[];
};

function inviteUrl(ch: { id: string; name: string; keyB64: string }) {
  const payload = `${ch.id}.${encodeURIComponent(ch.name)}.${ch.keyB64}`;
  return `${location.origin}/#i=${payload}`;
}

function parseInviteHash(): { id: string; name: string; keyB64: string } | null {
  const m = location.hash.match(/i=([^&]+)/);
  if (!m) return null;
  const parts = m[1].split(".");
  if (parts.length < 3) return null;
  const [id, name, ...rest] = parts;
  return { id, name: decodeURIComponent(name), keyB64: rest.join(".") };
}

export function ChatApp() {
  const [stage, setStage] = useState<"boot" | "lobby" | "name" | "chat">("boot");
  const [bootLines, setBootLines] = useState<string[]>([]);
  const [pendingInvite, setPendingInvite] = useState<{ id: string; name: string; keyB64: string } | null>(null);
  const [channel, setChannel] = useState<ChannelState | null>(null);

  // Boot
  useEffect(() => {
    const lines = [
      "» booting n1ckar//grid v2.0",
      "» init libsodium · aes-256-gcm ready",
      "» webrtc stack online",
      "» zero-persistence mode: locked",
      "» listening on broadcast channel...",
      "» ready.",
    ];
    let i = 0;
    const id = setInterval(() => {
      setBootLines((p) => [...p, lines[i++]]);
      if (i >= lines.length) {
        clearInterval(id);
        setTimeout(() => {
          const inv = parseInviteHash();
          if (inv) {
            setPendingInvite(inv);
            setStage("name");
          } else {
            setStage("lobby");
          }
        }, 450);
      }
    }, 180);
    return () => clearInterval(id);
  }, []);

  const enterChannel = async (info: { id: string; name: string; keyB64: string }, myName: string) => {
    const key = await importKeyB64(info.keyB64);
    const fp = await fingerprint(key);
    setChannel({
      id: info.id, name: info.name, key, keyB64: info.keyB64, fp,
      myName, members: new Map([[myName, Date.now()]]), messages: [],
    });
    setStage("chat");
    // clean URL so the invite hash is consumed
    history.replaceState(null, "", "/");
  };

  const createChannel = async (channelName: string, myName: string) => {
    const id = randomId(8);
    const key = await generateChannelKey();
    const keyB64 = await exportKeyB64(key);
    await enterChannel({ id, name: channelName, keyB64 }, myName);
  };

  const leaveChannel = () => {
    setChannel(null);
    setStage("lobby");
  };

  if (stage === "boot") return <BootScreen lines={bootLines} />;
  if (stage === "lobby") return <Lobby onCreate={createChannel} onJoinByLink={(inv) => { setPendingInvite(inv); setStage("name"); }} />;
  if (stage === "name" && pendingInvite) return (
    <NameGate invite={pendingInvite} onJoin={(name) => enterChannel(pendingInvite, name)} onCancel={() => setStage("lobby")} />
  );
  if (stage === "chat" && channel) return <ChannelView channel={channel} setChannel={setChannel} onLeave={leaveChannel} />;
  return null;
}

/* ───────────────── Boot ───────────────── */

function BootScreen({ lines }: { lines: string[] }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 grid-bg" />
      <div className="w-full max-w-lg glass-strong rounded-xl p-6 holo-edge animate-float">
        <div className="flex items-center gap-2 text-cyan text-xs mb-4 font-display">
          <Sparkles className="h-3.5 w-3.5" /> N1CKAR // GRID
        </div>
        <div className="space-y-1 text-sm text-cyan/90 font-mono min-h-[180px]">
          {lines.map((l, i) => <div key={i}>{l}</div>)}
          <span className="inline-block w-2 h-4 bg-cyan animate-blink align-middle ml-1" />
        </div>
      </div>
    </div>
  );
}

/* ───────────────── Lobby ───────────────── */

function Lobby({
  onCreate,
  onJoinByLink,
}: {
  onCreate: (channelName: string, myName: string) => void;
  onJoinByLink: (inv: { id: string; name: string; keyB64: string }) => void;
}) {
  const [chName, setChName] = useState("");
  const [myName, setMyName] = useState("");
  const [link, setLink] = useState("");
  const [err, setErr] = useState("");

  const handleJoin = () => {
    try {
      const url = new URL(link.trim());
      const m = url.hash.match(/i=([^&]+)/);
      if (!m) throw new Error();
      const [id, name, ...rest] = m[1].split(".");
      if (!id || !name || !rest.length) throw new Error();
      onJoinByLink({ id, name: decodeURIComponent(name), keyB64: rest.join(".") });
    } catch {
      setErr("invalid invite link");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative">
      <div className="absolute inset-0 grid-bg pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-px animate-scan" />

      <div className="w-full max-w-5xl relative">
        <header className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-[10px] uppercase tracking-[0.3em] text-cyan mb-5">
            <Radio className="h-3 w-3" /> zero-persistence · e2ee · serverless
          </div>
          <h1 className="font-display text-5xl md:text-7xl font-bold text-gradient animate-gradient">
            N1CKAR//GRID
          </h1>
          <p className="mt-4 text-muted-foreground text-sm max-w-xl mx-auto">
            Forge an encrypted channel. Share an invite link. Talk in the open without ever touching the cloud.
            Keys live in your browser. Messages live in RAM. Close the tab → it's gone.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-5">
          {/* CREATE */}
          <div className="glass-strong rounded-2xl p-6 holo-edge">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-8 w-8 rounded-lg bg-cyan/15 border border-cyan/40 flex items-center justify-center">
                <Hash className="h-4 w-4 text-cyan" />
              </div>
              <h2 className="font-display text-lg">FORGE CHANNEL</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-5">Generate a fresh AES-256 key. You become the operator.</p>
            <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1">channel name</label>
            <input
              value={chName}
              onChange={(e) => setChName(e.target.value)}
              placeholder="// midnight-ops"
              className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan/60 focus:neon-border mb-4"
            />
            <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1">your alias</label>
            <input
              value={myName}
              onChange={(e) => setMyName(e.target.value)}
              placeholder="// gh0st"
              className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan/60 focus:neon-border mb-5"
            />
            <button
              disabled={!chName.trim() || !myName.trim()}
              onClick={() => onCreate(chName.trim(), myName.trim())}
              className="w-full py-3 rounded-lg font-display text-sm bg-gradient-to-r from-cyan via-violet to-magenta text-primary-foreground font-bold tracking-widest disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-95 transition animate-gradient"
            >
              <span className="inline-flex items-center gap-2"><Zap className="h-4 w-4" /> CREATE & ENTER</span>
            </button>
          </div>

          {/* JOIN */}
          <div className="glass-strong rounded-2xl p-6 holo-edge">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-8 w-8 rounded-lg bg-magenta/15 border border-magenta/40 flex items-center justify-center">
                <Link2 className="h-4 w-4 text-magenta" />
              </div>
              <h2 className="font-display text-lg">JOIN VIA INVITE</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-5">Paste a link from your operator. The key rides in the URL fragment — never sent to any server.</p>
            <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1">invite link</label>
            <textarea
              value={link}
              onChange={(e) => { setLink(e.target.value); setErr(""); }}
              rows={4}
              placeholder="https://.../#i=..."
              className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-xs font-mono break-all focus:outline-none focus:border-magenta/60 mb-2 resize-none"
            />
            {err && <div className="text-xs text-destructive mb-2">// {err}</div>}
            <button
              disabled={!link.trim()}
              onClick={handleJoin}
              className="w-full py-3 rounded-lg font-display text-sm border border-magenta/50 text-magenta hover:bg-magenta/10 transition tracking-widest disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span className="inline-flex items-center gap-2"><Link2 className="h-4 w-4" /> DECODE INVITE</span>
            </button>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-3 text-center">
          <Stat icon={<Lock className="h-3 w-3" />} label="AES-256-GCM" />
          <Stat icon={<Shield className="h-3 w-3" />} label="ZERO CLOUD STORAGE" />
          <Stat icon={<KeyRound className="h-3 w-3" />} label="KEYS IN URL HASH" />
        </div>

        <footer className="mt-10 text-center text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          developed by <span className="text-cyan text-glow-cyan">n1ckar</span>
        </footer>
      </div>
    </div>
  );
}

function Stat({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="glass rounded-lg py-3 text-[10px] uppercase tracking-widest text-muted-foreground flex items-center justify-center gap-2">
      <span className="text-cyan">{icon}</span> {label}
    </div>
  );
}

/* ───────────────── Name Gate ───────────────── */

function NameGate({
  invite, onJoin, onCancel,
}: {
  invite: { id: string; name: string; keyB64: string };
  onJoin: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative">
      <div className="absolute inset-0 grid-bg pointer-events-none" />
      <div className="w-full max-w-md glass-strong rounded-2xl p-7 holo-edge animate-float">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-9 w-9 rounded-lg bg-magenta/15 border border-magenta/40 flex items-center justify-center">
            <Link2 className="h-4 w-4 text-magenta" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">invitation decoded</div>
            <div className="font-display text-xl text-glow-mag text-magenta">#{invite.name}</div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-4 mb-5">
          You've been handed a key. Pick an alias to enter the channel. Other members will see this name.
        </p>
        <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1">your alias</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && onJoin(name.trim())}
          placeholder="// nyx"
          className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-magenta/60 mb-5"
        />
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary/60 transition"
          >cancel</button>
          <button
            disabled={!name.trim()}
            onClick={() => onJoin(name.trim())}
            className="flex-1 py-2.5 rounded-lg font-display tracking-widest text-sm bg-gradient-to-r from-cyan to-magenta text-primary-foreground font-bold disabled:opacity-30"
          >ENTER</button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────── Channel View ───────────────── */

function ChannelView({
  channel, setChannel, onLeave,
}: {
  channel: ChannelState;
  setChannel: React.Dispatch<React.SetStateAction<ChannelState | null>>;
  onLeave: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [call, setCall] = useState<CallMode | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const busRef = useRef<ChannelBus | null>(null);

  // Bus lifecycle
  useEffect(() => {
    const bus = new ChannelBus(channel.id);
    busRef.current = bus;

    const off = bus.on(async (ev: WireEvent) => {
      if (ev.t === "msg") {
        try {
          const { text } = await decryptJson<{ text: string }>(channel.key, { iv: ev.iv, ct: ev.ct });
          if (ev.from === channel.myName) return; // already added locally
          setChannel((c) => c ? {
            ...c,
            messages: [...c.messages, { id: ev.id, from: ev.from, text, at: ev.at, mine: false }],
            members: new Map(c.members).set(ev.from, Date.now()),
          } : c);
        } catch { /* foreign key, ignore */ }
      } else if (ev.t === "join") {
        setChannel((c) => c ? {
          ...c,
          members: new Map(c.members).set(ev.name, ev.at),
          messages: [...c.messages, { id: randomId(6), from: "system", text: `${ev.name} joined the grid`, at: ev.at, mine: false }],
        } : c);
        // announce self back so they see us
        bus.send({ t: "presence-pong", name: channel.myName });
      } else if (ev.t === "leave") {
        setChannel((c) => c ? {
          ...c,
          messages: [...c.messages, { id: randomId(6), from: "system", text: `${ev.name} dropped`, at: ev.at, mine: false }],
        } : c);
      } else if (ev.t === "presence-ping") {
        bus.send({ t: "presence-pong", name: channel.myName });
      } else if (ev.t === "presence-pong") {
        setChannel((c) => c ? { ...c, members: new Map(c.members).set(ev.name, Date.now()) } : c);
      }
    });

    // announce
    bus.send({ t: "join", name: channel.myName, at: Date.now() });
    bus.send({ t: "presence-ping", name: channel.myName });

    const leaveHandler = () => bus.send({ t: "leave", name: channel.myName, at: Date.now() });
    window.addEventListener("beforeunload", leaveHandler);

    return () => {
      leaveHandler();
      off();
      bus.close();
      window.removeEventListener("beforeunload", leaveHandler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [channel.messages.length]);

  const send = async () => {
    if (!draft.trim() || !busRef.current) return;
    const text = draft.trim();
    setDraft("");
    const id = randomId(8);
    const at = Date.now();
    const payload = await encryptJson(channel.key, { text });
    setChannel((c) => c ? {
      ...c, messages: [...c.messages, { id, from: c.myName, text, at, mine: true }],
    } : c);
    busRef.current.send({ t: "msg", iv: payload.iv, ct: payload.ct, from: channel.myName, at, id });
  };

  const wipe = () => setChannel((c) => c ? { ...c, messages: [] } : c);

  const link = useMemo(() => inviteUrl(channel), [channel]);
  const copyLink = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const memberList = Array.from(channel.members.keys());

  return (
    <div className="h-screen flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 grid-bg pointer-events-none" />

      {/* Top bar */}
      <header className="relative z-10 h-14 px-4 flex items-center justify-between glass-strong border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-cyan to-magenta flex items-center justify-center font-display font-bold text-primary-foreground text-sm">
            #
          </div>
          <div className="min-w-0">
            <div className="font-display text-base text-glow-cyan truncate">{channel.name}</div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-2">
              <KeyRound className="h-2.5 w-2.5" /> {channel.fp}
              <span className="h-1 w-1 rounded-full bg-cyan animate-pulse" />
              {memberList.length} online
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowInvite(true)}
            className="h-9 px-3 rounded-lg border border-cyan/40 text-cyan text-xs font-display tracking-widest hover:bg-cyan/10 transition flex items-center gap-2"
          >
            <Link2 className="h-3.5 w-3.5" /> INVITE
          </button>
          <button onClick={() => setCall("audio")} className="h-9 w-9 rounded-lg border border-border hover:border-cyan/50 hover:text-cyan transition flex items-center justify-center">
            <Phone className="h-4 w-4" />
          </button>
          <button onClick={() => setCall("video")} className="h-9 w-9 rounded-lg border border-border hover:border-cyan/50 hover:text-cyan transition flex items-center justify-center">
            <Video className="h-4 w-4" />
          </button>
          <button onClick={wipe} className="h-9 w-9 rounded-lg border border-border hover:border-destructive hover:text-destructive transition flex items-center justify-center" title="wipe">
            <Trash2 className="h-4 w-4" />
          </button>
          <button onClick={onLeave} className="h-9 w-9 rounded-lg border border-border hover:border-destructive hover:text-destructive transition flex items-center justify-center" title="leave channel">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="relative z-10 flex-1 grid grid-cols-1 md:grid-cols-[1fr_240px] min-h-0">
        {/* Messages */}
        <main className="flex flex-col min-h-0">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-3">
            <div className="text-center text-[10px] text-muted-foreground uppercase tracking-[0.3em] py-3 border border-dashed border-border rounded-xl">
              — channel forged · AES-256-GCM session · nothing leaves this device —
            </div>
            {channel.messages.map((m) => (
              <MessageBubble key={m.id} m={m} />
            ))}
          </div>

          {/* Composer */}
          <div className="p-3 glass-strong border-t border-border">
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan text-xs font-mono select-none">{">"}</span>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="transmit payload · enter to encrypt + broadcast"
                  className="w-full bg-input border border-border rounded-xl pl-7 pr-3 py-3 text-sm focus:outline-none focus:border-cyan/60 focus:neon-border"
                />
              </div>
              <button
                onClick={send}
                className="h-12 px-5 rounded-xl bg-gradient-to-r from-cyan via-violet to-magenta text-primary-foreground font-display font-bold text-sm tracking-widest hover:opacity-95 transition animate-gradient flex items-center gap-2"
              >
                <Send className="h-4 w-4" /> SEND
              </button>
            </div>
            <div className="mt-1.5 text-[10px] text-muted-foreground flex items-center gap-2">
              <Lock className="h-2.5 w-2.5 text-cyan" /> encrypted locally before broadcast · no server, no logs · developed by <span className="text-cyan">n1ckar</span>
            </div>
          </div>
        </main>

        {/* Members */}
        <aside className="hidden md:flex flex-col glass border-l border-border min-h-0">
          <div className="p-3 border-b border-border flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            <Users className="h-3 w-3 text-cyan" /> operators · {memberList.length}
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {memberList.map((name) => (
              <div key={name} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-secondary/50">
                <div className="relative">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan/30 to-magenta/30 border border-cyan/30 flex items-center justify-center text-xs font-display">
                    {name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-cyan ring-2 ring-background animate-pulse-ring" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs truncate">{name}{name === channel.myName && <span className="text-cyan ml-1">· you</span>}</div>
                  <div className="text-[9px] text-muted-foreground">online</div>
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-border text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1.5 mb-1"><Shield className="h-3 w-3 text-cyan" /> channel intact</div>
            <div>messages: {channel.messages.length}</div>
          </div>
        </aside>
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-md flex items-center justify-center p-6" onClick={() => setShowInvite(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg glass-strong rounded-2xl p-6 holo-edge">
            <div className="flex items-center gap-2 mb-1">
              <Link2 className="h-4 w-4 text-magenta" />
              <h3 className="font-display text-lg">INVITE LINK</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Share this with people you trust. The decryption key is embedded in the URL fragment after <span className="text-cyan">#</span> — browsers never send fragments to any server.
            </p>
            <div className="bg-input border border-border rounded-lg p-3 text-[11px] font-mono break-all max-h-32 overflow-y-auto">
              {link}
            </div>
            <button
              onClick={copyLink}
              className="mt-4 w-full py-3 rounded-lg bg-gradient-to-r from-cyan to-magenta text-primary-foreground font-display font-bold tracking-widest text-sm flex items-center justify-center gap-2"
            >
              {copied ? <><Check className="h-4 w-4" /> COPIED</> : <><Copy className="h-4 w-4" /> COPY LINK</>}
            </button>
            <div className="mt-3 text-[10px] text-muted-foreground text-center">
              fingerprint <span className="text-cyan">{channel.fp}</span> · verify out-of-band
            </div>
          </div>
        </div>
      )}

      {call && <CallOverlay mode={call} contact={`#${channel.name}`} onEnd={() => setCall(null)} />}
    </div>
  );
}

function MessageBubble({ m }: { m: Msg }) {
  if (m.from === "system") {
    return (
      <div className="flex justify-center">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground bg-secondary/40 border border-border rounded-full px-3 py-1">
          » {m.text}
        </div>
      </div>
    );
  }
  return (
    <div className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[75%]">
        {!m.mine && (
          <div className="text-[10px] uppercase tracking-widest text-magenta mb-1 ml-1">{m.from}</div>
        )}
        <div className={`rounded-2xl px-4 py-2.5 border ${
          m.mine
            ? "bg-gradient-to-br from-cyan/15 to-violet/15 border-cyan/40 rounded-br-sm"
            : "glass border-border rounded-bl-sm"
        }`}>
          <div className="text-sm leading-relaxed break-words">{m.text}</div>
          <div className="mt-1 flex items-center gap-1 text-[9px] text-muted-foreground">
            <Lock className="h-2.5 w-2.5 text-cyan" />
            {new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      </div>
    </div>
  );
}
