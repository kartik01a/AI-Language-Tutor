"use client";

import { useState } from "react";
import type { CorrectionCard } from "@/lib/tutor/correction-pipeline";

/**
 * Correction cards (docs/02 §5.5). Amber for fixes, blue for optional alternatives — never red,
 * which is reserved for recording. In Balanced/Strict the answer stays hidden until asked for.
 */
export function CorrectionCards({ cards, onReport }: { cards: CorrectionCard[]; onReport: (cardId: string) => void }) {
  return (
    <div className="mt-1 space-y-2 text-left">
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
      className={`ml-8 inline-block max-w-full rounded-xl border-l-4 px-3 py-2 text-sm ${alt ? "border-sky-600 bg-sky-50" : "border-amber-600 bg-amber-50"}`}
      data-testid="correction-card"
    >
      <div className="font-medium">{alt ? "💡 More natural (optional)" : "💡 Something to fix"}</div>
      {revealed ? (
        <>
          <div lang="ja" className="mt-1 text-base">
            <span className="line-through decoration-amber-700">{card.original}</span> → <span className="font-semibold underline">{card.corrected}</span>
          </div>
          <div className="mt-1">{card.explanation}</div>
          <div lang="ja" className="mt-1 text-neutral-600">{card.example}</div>
        </>
      ) : (
        <div className="mt-1">
          <span lang="ja" className="text-base">「<span className="underline decoration-amber-600 decoration-wavy">{card.original}</span>」</span> — can you spot it?
          <div className="mt-1">
            <button onClick={() => setRevealed(true)} className="rounded-full border border-amber-700 px-3 py-1 text-xs text-amber-900">
              Show answer
            </button>
          </div>
        </div>
      )}
      <div className="mt-1">
        {reported ? (
          <span className="text-xs text-neutral-500">Thanks — noted.</span>
        ) : (
          <button
            onClick={() => {
              setReported(true);
              onReport(card.id);
            }}
            className="text-xs text-neutral-500 underline"
            aria-label="Report this correction as wrong"
          >
            ⚑ This was wrong
          </button>
        )}
      </div>
    </div>
  );
}
