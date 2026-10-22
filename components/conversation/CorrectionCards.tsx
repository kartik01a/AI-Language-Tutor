"use client";

import { useState } from "react";
import type { CorrectionCard } from "@/lib/tutor/correction-pipeline";

/**
 * Correction cards (docs/02 §5.5). Amber for fixes, blue for optional alternatives — never red,
 * which is reserved for recording. In Balanced/Strict the answer stays hidden until asked for.
 */
export function CorrectionCards({ cards, onReport, align = "end" }: { cards: CorrectionCard[]; onReport: (cardId: string) => void; align?: "start" | "end" }) {
  return (
    <div className={`mt-2 flex w-full flex-col gap-2 text-left ${align === "end" ? "items-end" : "items-start"}`}>
      {cards.map((c) => (
        <Card key={c.id} card={c} onReport={onReport} />
      ))}
    </div>
  );
}

function Card({ card, onReport }: { card: CorrectionCard; onReport: (id: string) => void }) {
  const [revealed, setRevealed] = useState(!card.tryAgainFirst);
  const [reported, setReported] = useState(false);
  const alt = card.card === "alternative";
  return (
    <div
      className={`max-w-[92%] rounded-2xl border-l-4 px-3.5 py-2.5 text-sm shadow-bubble ${alt ? "border-sky-ink bg-sky-card text-ink-900" : "border-amber-ink bg-amber-card text-ink-900"}`}
      data-testid="correction-card"
    >
      <div className={`font-extrabold ${alt ? "text-sky-ink" : "text-amber-ink"}`}>{alt ? "💡 More natural (optional)" : "💡 Something to fix"}</div>
      {revealed ? (
        <>
          <div lang="ja" className="mt-1 text-base">
            <span className="line-through decoration-amber-ink">{card.original}</span> → <span className="font-semibold underline">{card.corrected}</span>
          </div>
          <div className="mt-1">{card.explanation}</div>
          <div lang="ja" className="mt-1 text-ink-600">{card.example}</div>
        </>
      ) : (
        <div className="mt-1">
          <span lang="ja" className="text-base">「<span className="underline decoration-amber-ink decoration-wavy">{card.original}</span>」</span> — can you spot it?
          <div className="mt-1">
            <button onClick={() => setRevealed(true)} className="rounded-full border border-amber-ink bg-white/60 px-3 py-1 text-xs font-bold text-amber-ink">
              Show answer
            </button>
          </div>
        </div>
      )}
      <div className="mt-1">
        {reported ? (
          <span className="text-xs text-ink-400">Thanks — noted.</span>
        ) : (
          <button
            onClick={() => {
              setReported(true);
              onReport(card.id);
            }}
            className="text-xs text-ink-400 underline"
            aria-label="Report this correction as wrong"
          >
            ⚑ This was wrong
          </button>
        )}
      </div>
    </div>
  );
}
