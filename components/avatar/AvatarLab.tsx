"use client";

import { useEffect, useRef, useState } from "react";
import { AvatarStage, type AvatarStageHandle } from "./AvatarStage";
import type { AvatarState, ExpressionId } from "@/lib/avatar/controller";
import { kanaToShapes, type VisemeEvent, type VisemeId } from "@/lib/avatar/visemes";

const STATES: AvatarState[] = ["idle", "listening", "thinking", "speaking", "happy", "confused", "celebrating"];
const EXPRESSIONS: ExpressionId[] = ["neutral", "happy", "thinking", "confused", "encouraging", "celebrating"];
const VISEMES: VisemeId[] = ["rest", "mbp", "cons", "a", "i", "u", "e", "o", "fv", "l_th"];

const SAMPLE = "こんにちは、きょうはなにをたべましたか";

function sampleTrack(msPerMora = 110): VisemeEvent[] {
  return kanaToShapes(SAMPLE).map((v, i) => ({ t: i * msPerMora, v }));
}

export function AvatarLab({ svg }: { svg: string }) {
  const stage = useRef<AvatarStageHandle>(null);
  const [state, setState] = useState<AvatarState>("idle");
  const [cost, setCost] = useState(0);
  const [reduced, setReduced] = useState(false);
  const speakToken = useRef(0);

  useEffect(() => {
    const id = setInterval(() => setCost(stage.current?.frameCostMs() ?? 0), 500);
    return () => clearInterval(id);
  }, []);

  const choose = (s: AvatarState) => {
    speakToken.current++;
    setState(s);
    stage.current?.controller.stopSpeaking();
    stage.current?.controller.setViseme(null);
    stage.current?.controller.setState(s);
  };

  const speak = () => {
    const c = stage.current?.controller;
    if (!c) return;
    const token = ++speakToken.current;
    c.setViseme(null);
    c.playVisemeTrack(sampleTrack(), () => performance.now());
    setState("speaking");
    const end = sampleTrack().length * 110 + 300;
    setTimeout(() => {
      if (speakToken.current === token) choose("listening");
    }, end);
  };

  const btn = "rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100 data-[on=true]:bg-indigo-600 data-[on=true]:text-white";

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-xl font-bold">Avatar Lab</h1>
      <p className="text-sm text-neutral-600">
        Dev-only. Drives the placeholder tutor through every state, expression and mouth shape (docs/03 §B10).
      </p>

      <AvatarStage ref={stage} svg={svg} className="mx-auto aspect-square w-full max-w-sm rounded-2xl bg-pink-50" />

      <section aria-label="States" className="flex flex-wrap gap-2">
        {STATES.map((s) => (
          <button key={s} data-on={state === s} className={btn} onClick={() => choose(s)}>
            {s}
          </button>
        ))}
        <button className={btn} onClick={speak}>
          ▶ play sample line ({SAMPLE.slice(0, 5)}…)
        </button>
      </section>

      <section aria-label="Expressions" className="flex flex-wrap gap-2">
        {EXPRESSIONS.map((e) => (
          <button key={e} className={btn} onClick={() => stage.current?.controller.setExpression(e)}>
            {e}
          </button>
        ))}
        <button className={btn} onClick={() => stage.current?.controller.setExpression(null)}>
          (auto)
        </button>
      </section>

      <section aria-label="Mouth shapes" className="flex flex-wrap gap-2">
        {VISEMES.map((v) => (
          <button key={v} className={btn} onClick={() => stage.current?.controller.setViseme(v)}>
            {v}
          </button>
        ))}
        <button className={btn} onClick={() => stage.current?.controller.setViseme(null)}>
          (auto)
        </button>
      </section>

      <section className="flex items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={reduced}
            onChange={(e) => {
              setReduced(e.target.checked);
              stage.current?.controller.setReducedMotion(e.target.checked);
            }}
          />
          Reduced motion
        </label>
        <span data-testid="frame-cost">Frame cost: {cost.toFixed(2)} ms (budget ≤ 2 ms avg, 4 ms max)</span>
      </section>
    </main>
  );
}
