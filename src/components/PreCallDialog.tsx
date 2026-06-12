import { useState } from "react";
import { Phone, Video, Mic, MicOff, VideoOff, Shield, X } from "lucide-react";
import type { CallMode } from "./CallOverlay";

export function PreCallDialog({
  mode,
  contact,
  onConfirm,
  onCancel,
}: {
  mode: CallMode;
  contact: string;
  onConfirm: (opts: { startMuted: boolean; startCamOff: boolean }) => void;
  onCancel: () => void;
}) {
  const [startMuted, setStartMuted] = useState(true);
  const [startCamOff, setStartCamOff] = useState(true);
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="fixed inset-0 z-50 bg-background/85 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="w-full max-w-md glass-strong rounded-2xl p-6 holo-edge">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-cyan/15 border border-cyan/40 flex items-center justify-center">
              {mode === "video" ? <Video className="h-4 w-4 text-cyan" /> : <Phone className="h-4 w-4 text-cyan" />}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {mode === "video" ? "video link" : "voice link"}
              </div>
              <div className="font-display text-base text-glow-cyan truncate max-w-[220px]">{contact}</div>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="h-8 w-8 rounded-lg border border-border hover:border-destructive hover:text-destructive flex items-center justify-center"
            aria-label="close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-xl border border-border bg-input/40 p-3 text-xs text-muted-foreground mb-4 leading-relaxed">
          NULLROOM will ask your browser for {mode === "video" ? "microphone + camera" : "microphone"} access.
          The stream travels peer-to-peer over DTLS-SRTP — no server sees the media. You can revoke access any time from the browser address bar.
        </div>

        <div className="space-y-2 mb-4">
          <ToggleRow
            label="Join muted"
            sub="Recommended · unmute when you're ready"
            on={startMuted}
            onChange={setStartMuted}
            icon={startMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          />
          {mode === "video" && (
            <ToggleRow
              label="Camera off"
              sub="Recommended · enable when you're framed"
              on={startCamOff}
              onChange={setStartCamOff}
              icon={startCamOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
            />
          )}
        </div>

        <label className="flex items-start gap-2 text-xs text-muted-foreground mb-5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 accent-cyan"
          />
          <span>
            I confirm I have consent from everyone in view of my camera / microphone, and
            understand NULLROOM cannot prevent OS-level screen recording on the peer's device.
          </span>
        </label>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary/60 transition"
          >
            cancel
          </button>
          <button
            disabled={!agreed}
            onClick={() => onConfirm({ startMuted, startCamOff: mode === "video" ? startCamOff : false })}
            className="flex-1 py-3 rounded-lg font-display tracking-widest text-sm bg-gradient-to-r from-cyan to-magenta text-primary-foreground font-bold disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            <Shield className="h-4 w-4" /> CONNECT
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label, sub, on, onChange, icon,
}: {
  label: string; sub: string; on: boolean; onChange: (v: boolean) => void; icon: React.ReactNode;
}) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
        on ? "border-cyan/50 bg-cyan/5" : "border-border hover:border-border/80"
      }`}
    >
      <div className={`h-8 w-8 rounded-lg border flex items-center justify-center ${on ? "border-cyan/50 text-cyan" : "border-border text-muted-foreground"}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm">{label}</div>
        <div className="text-[10px] text-muted-foreground">{sub}</div>
      </div>
      <div className={`h-5 w-9 rounded-full relative transition ${on ? "bg-cyan/60" : "bg-secondary"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-background transition-all ${on ? "left-4" : "left-0.5"}`} />
      </div>
    </button>
  );
}
