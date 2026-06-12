import { useEffect, useRef, useState } from "react";
import { Video, MicOff, Mic, VideoOff, PhoneOff, Shield, Loader2 } from "lucide-react";
import type { ChannelBus, WireEvent } from "@/lib/channelBus";

type Mode = "audio" | "video";
type Role = "caller" | "callee";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:global.stun.twilio.com:3478" },
];

export function CallOverlay({
  mode,
  contact,
  bus,
  myName,
  role,
  peerName,
  remoteOffer,
  onEnd,
}: {
  mode: Mode;
  contact: string;
  bus: ChannelBus;
  myName: string;
  role: Role;
  peerName?: string;
  remoteOffer?: RTCSessionDescriptionInit;
  onEnd: () => void;
}) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteSetRef = useRef(false);
  const peerRef = useRef<string | undefined>(peerName);

  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [secs, setSecs] = useState(0);
  const [status, setStatus] = useState<"requesting-media" | "ringing" | "connecting" | "live" | "ended">(
    "requesting-media",
  );
  const [error, setError] = useState<string | null>(null);
  const [hasRemote, setHasRemote] = useState(false);

  // Set up RTCPeerConnection + media + signalling
  useEffect(() => {
    let cancelled = false;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate && peerRef.current) {
        bus.send({
          t: "call-ice",
          from: myName,
          to: peerRef.current,
          candidate: e.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (e) => {
      const [stream] = e.streams;
      if (!stream) return;
      setHasRemote(true);
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = stream;
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "connected") setStatus("live");
      else if (s === "failed" || s === "disconnected" || s === "closed") {
        setStatus("ended");
      }
    };

    const off = bus.on(async (ev: WireEvent) => {
      if (ev.t === "call-answer" && role === "caller" && ev.to === myName) {
        peerRef.current = ev.from;
        if (!remoteSetRef.current) {
          await pc.setRemoteDescription(new RTCSessionDescription(ev.sdp));
          remoteSetRef.current = true;
          for (const c of pendingIceRef.current) {
            try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
          }
          pendingIceRef.current = [];
          setStatus("connecting");
        }
      } else if (ev.t === "call-ice" && ev.to === myName) {
        if (remoteSetRef.current) {
          try { await pc.addIceCandidate(new RTCIceCandidate(ev.candidate)); } catch {}
        } else {
          pendingIceRef.current.push(ev.candidate);
        }
      } else if (ev.t === "call-end") {
        if (!peerRef.current || ev.from === peerRef.current) {
          setStatus("ended");
          setTimeout(() => onEnd(), 600);
        }
      }
    });

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: mode === "video",
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        if (localVideoRef.current && mode === "video") {
          localVideoRef.current.srcObject = stream;
        }

        if (role === "caller") {
          setStatus("ringing");
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          // Broadcast to whole channel (no `to`) — first answerer wins.
          bus.send({ t: "call-offer", from: myName, mode, sdp: offer });
        } else if (role === "callee" && remoteOffer) {
          peerRef.current = peerName;
          await pc.setRemoteDescription(new RTCSessionDescription(remoteOffer));
          remoteSetRef.current = true;
          for (const c of pendingIceRef.current) {
            try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
          }
          pendingIceRef.current = [];
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          bus.send({ t: "call-answer", from: myName, to: peerName!, sdp: answer });
          setStatus("connecting");
        }
      } catch (e: any) {
        setError(e?.message || "media access denied");
      }
    })(); 

    return () => {
      cancelled = true;
      off();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      try { pc.close(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer
  useEffect(() => {
    if (status !== "live") return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  const hangup = () => {
    bus.send({ t: "call-end", from: myName });
    setStatus("ended");
    onEnd();
  };

  const toggleMute = () => {
    const s = localStreamRef.current;
    if (!s) return;
    const next = !muted;
    s.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  };
  const toggleCam = () => {
    const s = localStreamRef.current;
    if (!s) return;
    const next = !camOff;
    s.getVideoTracks().forEach((t) => (t.enabled = !next));
    setCamOff(next);
  };

  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  const statusLabel =
    status === "requesting-media" ? "requesting media…"
    : status === "ringing" ? "ringing peer…"
    : status === "connecting" ? "negotiating p2p tunnel…"
    : status === "live" ? `live · ${mm}:${ss}`
    : "ended";

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex flex-col">
      <audio ref={remoteAudioRef} autoPlay playsInline />
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className={`h-2 w-2 rounded-full ${status === "live" ? "bg-cyan" : "bg-destructive"} animate-pulse`} />
          <span className="text-xs text-muted-foreground uppercase tracking-widest">
            {mode === "video" ? "VIDEO LINK" : "VOICE LINK"} // WEBRTC // E2EE
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-cyan">
          <Shield className="h-3 w-3" /> {statusLabel}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 relative">
        {mode === "video" ? (
          <div className="relative w-full max-w-5xl aspect-video rounded-lg overflow-hidden border border-cyan/40 neon-border bg-black">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover bg-black"
            />
            {!hasRemote && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-cyan" />
                <div className="text-xs uppercase tracking-widest">{statusLabel}</div>
              </div>
            )}
            <div className="absolute bottom-3 right-3 w-40 aspect-video rounded-md overflow-hidden border border-cyan/40 bg-black">
              <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              {camOff && (
                <div className="absolute inset-0 bg-background/90 flex items-center justify-center text-[10px] text-muted-foreground">
                  CAMERA OFF
                </div>
              )}
            </div>
            <div className="absolute top-3 left-3 px-2 py-1 text-[10px] bg-background/70 border border-border rounded">
              ENCRYPTED P2P · DTLS-SRTP
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="relative mx-auto h-48 w-48 rounded-full border-2 border-cyan/60 flex items-center justify-center text-6xl text-glow-cyan animate-pulse-ring">
              {contact.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "??"}
            </div>
            <div className="mt-8 text-2xl text-glow-cyan font-display">{contact}</div>
            <div className="mt-2 text-xs text-muted-foreground uppercase tracking-widest">
              {statusLabel}
            </div>
          </div>
        )}
        {error && (
          <div className="absolute bottom-6 px-4 py-2 bg-destructive/20 border border-destructive text-destructive-foreground text-xs rounded">
            {error}
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-4 pb-10">
        <button
          onClick={toggleMute}
          className="h-14 w-14 rounded-full border border-border bg-card hover:bg-secondary flex items-center justify-center transition"
        >
          {muted ? <MicOff className="h-5 w-5 text-destructive" /> : <Mic className="h-5 w-5 text-cyan" />}
        </button>
        {mode === "video" && (
          <button
            onClick={toggleCam}
            className="h-14 w-14 rounded-full border border-border bg-card hover:bg-secondary flex items-center justify-center transition"
          >
            {camOff ? <VideoOff className="h-5 w-5 text-destructive" /> : <Video className="h-5 w-5 text-cyan" />}
          </button>
        )}
        <button
          onClick={hangup}
          className="h-14 w-20 rounded-full bg-destructive hover:bg-destructive/80 flex items-center justify-center transition"
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

export type { Mode as CallMode, Role as CallRole };
