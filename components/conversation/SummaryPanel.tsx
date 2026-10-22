"use client";

import { useEffect, useState } from "react";
import type { SessionSummary } from "@/lib/learning/summary";
import { CorrectionCards } from "./CorrectionCards";

type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; summary: SessionSummary };

/** End-of-session summary (docs/02 §6.1): did well, fixes, new words, honest stats, level estimate. */
export function SummaryPanel({ sessionId }: { sessionId: string }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sessions/${sessionId}/summary`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error?.message ?? "Could not load your summary");
        if (!cancelled) setLoad({ state: "ready", summary: j });
      })
      .catch((e: Error) => !cancelled && setLoad({ state: "error", message: e.message }));
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (load.state === "loading") return <p className="px-4 py-6 text-center text-sm text-ink-600">Preparing your summary…</p>;
  if (load.state === "error") return <p role="alert" className="px-4 py-6 text-center text-sm text-red-800">{load.message}</p>;
  const s = load.summary;

  return (
    <section aria-labelledby="summary-title" className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm">
      <h2 id="summary-title" className="font-display text-2xl font-bold">
        Your summary {s.status === "partial" && <span className="text-xs font-normal text-ink-400">(partial)</span>}
      </h2>

      {s.didWell.length > 0 && (
        <div className="rounded-2xl bg-white p-4 shadow-bubble ring-1 ring-ink-900/5">
          <h3 className="font-extrabold">🌟 You did well</h3>
          <ul className="mt-1 space-y-1">
            {s.didWell.map((d) => (
              <li key={d.evidence}>
                {d.text} <span lang="ja" className="text-ink-400">「{d.evidence}」</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {s.fixes.length > 0 && (
        <div className="rounded-2xl bg-white p-4 shadow-bubble ring-1 ring-ink-900/5">
          <h3 className="font-extrabold">💡 Worth fixing</h3>
          <CorrectionCards cards={s.fixes.map((c) => ({ ...c, tryAgainFirst: false }))} onReport={() => {}} align="start" />
        </div>
      )}

      {s.worthASecondLook.length > 0 && (
        <div className="rounded-2xl bg-white p-4 shadow-bubble ring-1 ring-ink-900/5">
          <h3 className="font-extrabold">🤔 Worth a second look</h3>
          <p className="text-ink-600">We weren&apos;t sure about these, so please don&apos;t take them as mistakes:</p>
          <ul lang="ja" className="mt-1 list-disc pl-5">
            {s.worthASecondLook.map((c) => (
              <li key={c.id}>{c.original} → {c.corrected}</li>
            ))}
          </ul>
        </div>
      )}

      {s.newWords.length > 0 && (
        <div className="rounded-2xl bg-white p-4 shadow-bubble ring-1 ring-ink-900/5">
          <h3 className="font-extrabold">📚 New words</h3>
          <ul className="mt-1">
            {s.newWords.map((w) => (
              <li key={w.lemma}>
                <span lang="ja">{w.lemma}</span> {w.reading && <span lang="ja" className="text-ink-400">({w.reading})</span>} — {w.meaning}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl bg-white p-4 shadow-bubble ring-1 ring-ink-900/5">
        <h3 className="font-extrabold">⏱ This conversation</h3>
        <p>
          {s.stats.speakingSeconds}s speaking · {s.stats.turns} turns · {s.stats.hintsUsed} hints
          {s.stats.unclearTurns > 0 && ` · ${s.stats.unclearTurns} times we couldn't hear you clearly`}
        </p>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-bubble ring-1 ring-ink-900/5">
        <h3 className="font-extrabold">📈 Estimated level</h3>
        <p data-testid="level">
          {s.level.after} <span className="text-ink-400">(estimate{s.level.likely[0] !== s.level.likely[1] ? `, likely ${s.level.likely[0]}–${s.level.likely[1]}` : ""})</span>
          {s.level.changed && " — moving!"}
        </p>
        {s.level.reason && <p className="text-ink-600">{s.level.reason}</p>}
        <p className="text-xs text-ink-400">We estimate this from how you speak. It&apos;s not an exam result.</p>
      </div>

      {s.nextFocus && (
        <p>
          <span className="font-semibold">Next time:</span> {s.nextFocus}
        </p>
      )}

      <button onClick={() => location.reload()} className="w-full rounded-full bg-iris-500 px-5 py-3 text-base font-extrabold text-white shadow-md transition active:scale-[0.97]">
        Practice again
      </button>
    </section>
  );
}
