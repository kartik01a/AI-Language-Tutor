import { visemeAt, type VisemeEvent, type VisemeId } from "./visemes";

// Avatar animation controller (docs/03 §B1, §B7). Frame computation is pure — it takes a time
// and returns what to draw — so it is unit-testable without a DOM. A thin adapter applies frames.

export type AvatarState = "idle" | "listening" | "thinking" | "speaking" | "happy" | "confused" | "celebrating";
export type ExpressionId = "neutral" | "happy" | "thinking" | "confused" | "encouraging" | "celebrating";

export const STATE_EXPRESSION: Record<AvatarState, ExpressionId> = {
  idle: "neutral", listening: "neutral", thinking: "thinking", speaking: "neutral",
  happy: "happy", confused: "confused", celebrating: "celebrating",
};

/** Mouth shown when no viseme track is driving it. */
export const STATE_REST_MOUTH: Record<AvatarState, VisemeId> = {
  idle: "rest", listening: "rest", thinking: "rest", speaking: "rest",
  happy: "rest", confused: "o", celebrating: "a",
};

export interface Frame {
  mouth: VisemeId;
  expression: ExpressionId;
  /** 0 = eyes open, 1 = fully closed. */
  blink: number;
  bodyScaleY: number;
  headRotationDeg: number;
  rigOffsetY: number;
  pupil: { x: number; y: number };
}

export type Rng = () => number;

/** Blink intervals ~ log-normal around 3.5 s idle / 2.5 s speaking, clamped 1.2–8 s; 15% double blinks. */
export function nextBlinkDelayMs(rng: Rng, speaking: boolean): number {
  const mean = speaking ? 2500 : 3500;
  // Box–Muller normal → log-normal with modest spread.
  const u1 = Math.max(1e-9, rng());
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const v = mean * Math.exp(0.35 * z - 0.06);
  return Math.min(8000, Math.max(1200, v));
}

const BLINK_CLOSE_MS = 60;
const BLINK_HOLD_MS = 30;
const BLINK_OPEN_MS = 90;
export const BLINK_DURATION_MS = BLINK_CLOSE_MS + BLINK_HOLD_MS + BLINK_OPEN_MS;

/** Eyelid closure (0–1) at `elapsed` ms into a blink. */
export function blinkProfile(elapsed: number, scale = 1): number {
  const close = BLINK_CLOSE_MS * scale;
  const hold = BLINK_HOLD_MS * scale;
  const open = BLINK_OPEN_MS * scale;
  if (elapsed < 0 || elapsed >= close + hold + open) return 0;
  if (elapsed < close) return elapsed / close;
  if (elapsed < close + hold) return 1;
  const t = (elapsed - close - hold) / open;
  return 1 - (1 - (1 - t) * (1 - t)); // ease-out open
}

export class AvatarController {
  private state: AvatarState = "idle";
  private expressionOverride: ExpressionId | null = null;
  private track: VisemeEvent[] | null = null;
  /** Returns elapsed audible ms since the start of the current message. */
  private clock: (() => number) | null = null;
  private reducedMotion = false;
  private blinkEnabled = true;
  private blinkAt: number | null = null;
  private blinkScale = 1;
  private pendingDouble: number | null = null;
  private nextBlinkAt = 0;
  private started = false;
  private forcedMouth: VisemeId | null = null;

  constructor(private rng: Rng = Math.random) {}

  setState(s: AvatarState) {
    this.state = s;
    if (s !== "speaking") this.track = null;
    // Short blinks only while listening (long listener blinks signal "you can stop").
    this.blinkScale = s === "listening" ? 0.8 : s === "confused" ? 1.6 : 1;
  }
  getState() {
    return this.state;
  }
  setExpression(e: ExpressionId | null) {
    this.expressionOverride = e;
  }
  setViseme(v: VisemeId | null) {
    this.forcedMouth = v;
  }
  /** Art whose eyes can't blink convincingly opts out via data-blink="off" on the SVG root. */
  setBlinkEnabled(on: boolean) {
    this.blinkEnabled = on;
  }
  setReducedMotion(on: boolean) {
    this.reducedMotion = on;
  }
  blink(kind: "short" | "long" = "short") {
    this.blinkScale = kind === "long" ? 1.8 : 1;
    this.blinkAt = this.lastNow;
  }

  /**
   * Begin lip-syncing a message. `clock` returns elapsed audible ms since the message started
   * (AudioContext time − start − output latency); times in tracks are on that same timeline.
   */
  startMessage(clock: () => number) {
    this.track = [];
    this.clock = clock;
    this.state = "speaking";
  }
  /** Append mouth shapes for a later sentence; `offsetMs` places it on the message timeline. */
  appendVisemes(events: VisemeEvent[], offsetMs = 0) {
    if (!this.track) this.track = [];
    for (const e of events) this.track.push({ t: e.t + offsetMs, v: e.v });
  }
  playVisemeTrack(track: VisemeEvent[], clock: () => number) {
    this.startMessage(clock);
    this.appendVisemes(track);
  }
  stopSpeaking() {
    this.track = null;
    this.clock = null;
  }

  private lastNow = 0;

  frame(nowMs: number): Frame {
    this.lastNow = nowMs;
    if (!this.started) {
      this.started = true;
      this.nextBlinkAt = nowMs + nextBlinkDelayMs(this.rng, false);
    }

    // Blink scheduling (blinking is meaningful, so it stays under reduced motion).
    if (this.blinkEnabled && this.blinkAt === null && nowMs >= this.nextBlinkAt) {
      this.blinkAt = nowMs;
      const speaking = this.state === "speaking";
      if (this.rng() < 0.15) this.pendingDouble = nowMs + BLINK_DURATION_MS + 150 + this.rng() * 100;
      this.nextBlinkAt = nowMs + nextBlinkDelayMs(this.rng, speaking);
    }
    let blink = 0;
    if (this.blinkAt !== null) {
      const el = nowMs - this.blinkAt;
      if (el >= BLINK_DURATION_MS * this.blinkScale) this.blinkAt = null;
      else blink = blinkProfile(el, this.blinkScale);
    }
    if (this.blinkAt === null && this.pendingDouble !== null && nowMs >= this.pendingDouble) {
      this.pendingDouble = null;
      this.blinkAt = nowMs;
    }

    // Mouth: viseme track while speaking, otherwise the state's rest mouth.
    let mouth: VisemeId = STATE_REST_MOUTH[this.state];
    if (this.forcedMouth) mouth = this.forcedMouth;
    else if (this.track && this.clock) mouth = visemeAt(this.track, this.clock());

    const t = nowMs / 1000;
    const still = this.reducedMotion;
    const tilt = this.state === "listening" ? 4 : this.state === "confused" ? 6 : 0;
    const sway = still ? 0 : 1.5 * (Math.sin((2 * Math.PI * t) / 7.3) + Math.sin((2 * Math.PI * t) / 11.1)) / 2;
    const breathPeriod = this.state === "celebrating" ? 2.8 : 3.6;
    const breath = still ? 1 : 1 + 0.012 * Math.sin((2 * Math.PI * t) / breathPeriod);
    const jump = !still && this.state === "celebrating" ? -Math.abs(Math.sin(t * 6)) * 14 : 0;

    const pupil =
      this.state === "thinking" ? { x: -2, y: -2 } : this.state === "listening" ? { x: 0, y: 0 } : { x: 0, y: 0 };

    return {
      mouth,
      expression: this.expressionOverride ?? STATE_EXPRESSION[this.state],
      blink,
      bodyScaleY: breath,
      headRotationDeg: still ? tilt : tilt + sway,
      rigOffsetY: jump,
      pupil,
    };
  }
}

/** Applies a frame to the live SVG DOM. Browser-only; kept tiny and dumb on purpose. */
export function applyFrame(root: SVGElement, f: Frame, prev?: Frame): void {
  const q = (id: string) => root.querySelector<SVGElement>(`#${id}`);
  if (!prev || prev.mouth !== f.mouth) {
    root.querySelectorAll("[id^='mouth_']").forEach((el) => {
      const shape = el.id.replace("mouth_", "");
      if (["rest", "mbp", "cons", "a", "i", "u", "e", "o", "fv", "l_th"].includes(shape)) {
        el.setAttribute("visibility", shape === f.mouth ? "visible" : "hidden");
      }
    });
  }
  if (!prev || prev.expression !== f.expression) {
    root.querySelectorAll("[id^='expr_']").forEach((el) => {
      el.setAttribute("visibility", el.id === `expr_${f.expression}` ? "visible" : "hidden");
    });
  }
  const origin = (el: SVGElement | null) => {
    const p = el?.getAttribute("data-pivot")?.split(" ");
    if (el && p) {
      el.style.transformOrigin = `${p[0]}px ${p[1]}px`;
      el.style.transformBox = "view-box";
    }
  };
  const body = q("body");
  const head = q("head");
  const rig = q("rig");
  for (const el of [body, head, rig]) origin(el);
  if (body) body.style.transform = `scaleY(${f.bodyScaleY})`;
  if (head) head.style.transform = `rotate(${f.headRotationDeg}deg)`;
  if (rig) rig.style.transform = `translateY(${f.rigOffsetY}px)`;
  for (const side of ["l", "r"]) {
    const lid = q(`eye_${side}_lid`);
    const closed = q(`eye_${side}_closed`);
    const pupil = q(`eye_${side}_pupil`);
    origin(lid);
    if (lid) lid.style.transform = `scaleY(${f.blink})`;
    if (closed) closed.setAttribute("visibility", f.blink > 0.85 ? "visible" : "hidden");
    if (pupil) pupil.style.transform = `translate(${f.pupil.x}px, ${f.pupil.y}px)`;
  }
}
