import { useEffect, useRef, useState } from "react";
import { Phone, Video, MicOff, Mic, VideoOff, PhoneOff, Shield } from "lucide-react";

type Mode = "audio" | "video";

export function CallOverlay({
  mode,
  contact,
  onEnd,
}: {
  mode: Mode;
  contact: string;
  onEnd: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let s: MediaStream | null = null;
    (async () => {
      try {
        s = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: mode === "video",
        });
        setStream(s);
        if (videoRef.current && mode === "video") videoRef.current.srcObject = s;
      } catch (e: any) {
        setError(e?.message || "Media access denied");
      }
    })();
    return () => {
      s?.getTracks().forEach((t) => t.stop());
    };
  }, [mode]);

  useEffect(() => {
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const toggleMute = () => {
    if (!stream) return;
    const next = !muted;
    stream.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  };
  const toggleCam = () => {
    if (!stream) return;
    const next = !camOff;
    stream.getVideoTracks().forEach((t) => (t.enabled = !next));
    setCamOff(next);
  };

  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex flex-col">
      <div className="absolute inset-0 scanlines opacity-20 pointer-events-none" />
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-destructive animate-pulse-glow" />
          <span className="text-xs text-terminal-dim uppercase tracking-widest">
            {mode === "video" ? "VIDEO LINK" : "VOICE LINK"} // P2P // E2EE
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-terminal">
          <Shield className="h-3 w-3" /> SRTP+DTLS · {mm}:{ss}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 relative">
        {mode === "video" ? (
          <div className="relative w-full max-w-4xl aspect-video rounded-lg overflow-hidden border border-primary/40 box-glow">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover bg-black"
            />
            <div className="absolute top-3 left-3 px-2 py-1 text-[10px] bg-background/70 border border-border rounded">
              ENCRYPTED · LOCAL FEED
            </div>
            {camOff && (
              <div className="absolute inset-0 bg-background/90 flex items-center justify-center text-terminal-dim">
                CAMERA OFFLINE
              </div>
            )}
          </div>
        ) : (
          <div className="text-center">
            <div className="relative mx-auto h-48 w-48 rounded-full border-2 border-primary/60 flex items-center justify-center text-6xl text-glow animate-pulse-glow">
              {contact.slice(0, 2).toUpperCase()}
            </div>
            <div className="mt-8 text-2xl text-glow">{contact}</div>
            <div className="mt-2 text-xs text-terminal-dim uppercase tracking-widest">
              connection established · packet route: tor/wireguard
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
          {muted ? <MicOff className="h-5 w-5 text-destructive" /> : <Mic className="h-5 w-5 text-terminal" />}
        </button>
        {mode === "video" && (
          <button
            onClick={toggleCam}
            className="h-14 w-14 rounded-full border border-border bg-card hover:bg-secondary flex items-center justify-center transition"
          >
            {camOff ? <VideoOff className="h-5 w-5 text-destructive" /> : <Video className="h-5 w-5 text-terminal" />}
          </button>
        )}
        <button
          onClick={onEnd}
          className="h-14 w-20 rounded-full bg-destructive hover:bg-destructive/80 flex items-center justify-center transition"
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

export type { Mode as CallMode };
