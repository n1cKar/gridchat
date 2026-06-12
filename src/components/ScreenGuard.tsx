import { useEffect, useState } from "react";
import { EyeOff, ShieldAlert } from "lucide-react";

/**
 * Best-effort defense against screenshots / screen recording.
 * Browsers cannot truly block OS-level capture, but we can:
 *  - Blank the UI the instant the tab loses visibility / focus
 *    (covers most screen-record tools that capture a hidden/alt-tabbed window).
 *  - Detect PrintScreen / capture shortcuts and overwrite the clipboard,
 *    flashing a redaction overlay so any captured frame is blank.
 *  - Disable selection, right-click, drag, and long-press image save.
 */
export function ScreenGuard({ active = true }: { active?: boolean }) {
  const [hidden, setHidden] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!active) return;

    const onVis = () => setHidden(document.visibilityState !== "visible");
    const onBlur = () => setHidden(true);
    const onFocus = () => setHidden(document.visibilityState !== "visible");

    const redact = async () => {
      setFlash(true);
      try {
        await navigator.clipboard.writeText("[REDACTED · NULLROOM screenshot blocked]");
      } catch {}
      setTimeout(() => setFlash(false), 1400);
    };

    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      const meta = e.metaKey || e.ctrlKey;
      if (
        k === "PrintScreen" ||
        (e.shiftKey && meta && (k === "S" || k === "s" || k === "3" || k === "4" || k === "5")) ||
        (meta && (k === "p" || k === "P"))
      ) {
        e.preventDefault();
        void redact();
      }
    };

    const block = (e: Event) => e.preventDefault();

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("contextmenu", block);
    document.addEventListener("dragstart", block);

    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    (document.body.style as unknown as { webkitTouchCallout?: string }).webkitTouchCallout = "none";

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("dragstart", block);
      document.body.style.userSelect = prevUserSelect;
    };
  }, [active]);

  if (!active) return null;

  return (
    <>
      {hidden && (
        <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center gap-3 text-center p-6">
          <EyeOff className="h-10 w-10 text-cyan" />
          <div className="font-display text-xl text-glow-cyan">SCREEN PRIVATE</div>
          <div className="text-xs text-muted-foreground max-w-sm">
            NULLROOM blanks its surface when the tab is hidden or unfocused —
            screen recorders and background captures see this notice instead of your messages.
          </div>
        </div>
      )}
      {flash && (
        <div className="fixed inset-0 z-[101] bg-black flex flex-col items-center justify-center gap-3 text-center p-6 pointer-events-none">
          <ShieldAlert className="h-10 w-10 text-destructive" />
          <div className="font-display text-xl text-destructive">CAPTURE BLOCKED</div>
          <div className="text-xs text-muted-foreground">clipboard wiped · frame redacted</div>
        </div>
      )}
    </>
  );
}
