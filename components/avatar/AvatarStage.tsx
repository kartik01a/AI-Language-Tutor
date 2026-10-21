"use client";

import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { applyFrame, AvatarController, type Frame } from "@/lib/avatar/controller";

export interface AvatarStageHandle {
  controller: AvatarController;
  /** Average ms spent computing + applying a frame over the last 120 frames. */
  frameCostMs: () => number;
}

/** Renders a tutor SVG inline and animates it with an AvatarController (docs/03 §B1). */
export const AvatarStage = forwardRef<AvatarStageHandle, { svg: string; className?: string }>(function AvatarStage(
  { svg, className },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<AvatarController | null>(null);
  const costs = useRef<number[]>([]);
  if (controller.current === null) controller.current = new AvatarController();

  useImperativeHandle(ref, () => ({
    controller: controller.current as AvatarController,
    frameCostMs: () => (costs.current.length ? costs.current.reduce((a, b) => a + b, 0) / costs.current.length : 0),
  }));

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const c = controller.current as AvatarController;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    c.setReducedMotion(mq.matches);
    const onMq = () => c.setReducedMotion(mq.matches);
    mq.addEventListener("change", onMq);

    let raf = 0;
    let prev: Frame | undefined;
    const loop = (now: number) => {
      const root = el.querySelector("svg");
      if (root && !document.hidden) {
        const t0 = performance.now();
        const f = c.frame(now);
        applyFrame(root as unknown as SVGElement, f, prev);
        prev = f;
        costs.current.push(performance.now() - t0);
        if (costs.current.length > 120) costs.current.shift();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      mq.removeEventListener("change", onMq);
    };
  }, []);

  // The SVG comes from our own build pipeline (validated against the asset contract), not user input.
  return <div ref={host} className={className} role="img" aria-label="Tutor avatar" dangerouslySetInnerHTML={{ __html: svg }} />;
});
