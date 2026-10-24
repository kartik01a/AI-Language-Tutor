"use client";

import { useCallback, useSyncExternalStore } from "react";

export type CoachMode = "tutor" | "casual";

const KEY = "lactice.coachMode";
const EVENT = "lactice-coach-mode";

function read(): CoachMode {
  try {
    return localStorage.getItem(KEY) === "casual" ? "casual" : "tutor";
  } catch {
    return "tutor";
  }
}
const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};

/** The chosen mode, remembered on this device (Tutor by default; the server render always shows Tutor). */
export function useCoachMode(): [CoachMode, (m: CoachMode) => void] {
  const mode = useSyncExternalStore(subscribe, read, () => "tutor" as CoachMode);
  const set = useCallback((m: CoachMode) => {
    try {
      localStorage.setItem(KEY, m);
    } catch {}
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [mode, set];
}

const COPY: Record<CoachMode, { label: string; blurb: string }> = {
  tutor: { label: "Tutor", blurb: "I'll fix mistakes as we talk and show you how to say it." },
  casual: { label: "Casual", blurb: "Just a relaxed chat. I won't correct you." },
};

/** Tutor (corrections on) / Casual (just talk) switch. Default is Tutor. */
export function ModeToggle({ mode, onChange, showBlurb = true }: { mode: CoachMode; onChange: (m: CoachMode) => void; showBlurb?: boolean }) {
  return (
    <div className="w-full">
      <div role="group" aria-label="Conversation mode" className="mx-auto grid w-full max-w-xs grid-cols-2 rounded-full bg-paper-100 p-1">
        {(["tutor", "casual"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => onChange(m)}
            className={`rounded-full px-4 py-2 text-sm font-extrabold transition ${mode === m ? "bg-iris-500 text-white shadow-sm" : "text-ink-600"}`}
          >
            {COPY[m].label}
          </button>
        ))}
      </div>
      {showBlurb && <p className="mt-2 text-center text-xs text-ink-400">{COPY[mode].blurb}</p>}
    </div>
  );
}
