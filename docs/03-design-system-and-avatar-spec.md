# 03 — Design System & Avatar Asset Specification

> Related: [02 UX](02-user-journeys-and-ux.md) · [05 Voice & speech](05-voice-and-speech-architecture.md) (lip-sync timing) · [research notes: avatar](research/notes/avatar-lipsync-japanese-text.md)

Part A defines the visual language. Part B is the **technical asset contract** for the tutor characters you will draw.

---

# Part A — Design system

## A1. Brand direction

"Playful, warm, adult." Rounded geometry, soft depth, bright but not neon colours, generous whitespace, and a cartoon tutor as the emotional centre of every screen. Distinct from Duolingo: **no green-owl palette, no chunky 3D-bottom-border buttons, no mascot-guilt copy**. Our signature elements are:

- **The "speech bubble" shape** (rounded rectangle with a soft tail) reused for cards, chips and the logo placeholder.
- **The mic orb** — a large glowing circular button that is the only saturated primary element on the conversation screen.
- **Tutor accent colours** — each tutor tints their screens subtly (backgrounds, ring pulse), so learners associate a colour with a character.

App name **Lactice**; placeholder logo = speech-bubble glyph + wordmark in the display font. Both replaceable via `brand.config.ts`.

## A2. Colour tokens

Defined as CSS custom properties on `:root` (light). Dark-mode values are reserved under `[data-theme="dark"]` but not shipped in MVP (D-35).

### Primitive palette

| Token | Hex | Notes |
|---|---|---|
| `--iris-50` | `#F0F0FF` | |
| `--iris-100` | `#E0E0FC` | |
| `--iris-300` | `#A5A5F0` | |
| `--iris-500` | `#5B5BD6` | primary — white text contrast ≈ 5.4:1 |
| `--iris-700` | `#3E3EA8` | pressed / text on light |
| `--sun-300` | `#FFD976` | |
| `--sun-500` | `#FFC23D` | celebration accent (never text) |
| `--leaf-500` | `#2EB67D` | success |
| `--leaf-700` | `#1E7F56` | success text |
| `--amber-100` | `#FFF3D6` | fix card background |
| `--amber-600` | `#C97A00` | fix card accent/text |
| `--sky-100` | `#E3F0FF` | "more natural" card |
| `--sky-600` | `#2366C4` | |
| `--rose-500` | `#E5484D` | recording only |
| `--ink-900` | `#1C1B2E` | primary text |
| `--ink-600` | `#555470` | secondary text |
| `--ink-300` | `#B9B8CC` | borders / disabled |
| `--paper-0` | `#FFFFFF` | |
| `--paper-50` | `#FAF8F5` | app background (warm off-white) |
| `--paper-100` | `#F2EFEA` | sunken surfaces |

**Amendment 2026-10-23 (owner: "not pink"):** UI chrome is iris + warm paper only; tutor accents are not used for borders or backgrounds in the MVP, so Yuki's UI is not pink (her art still is). Tutor accents (originally `--tutor-yuki: #F47FA4` (sakura), `--tutor-lena: #14A3A3` (teal), `--tutor-sam: #FF8A3D` (tangerine)) are reserved for small details later. Used for ring pulse, avatar stage gradient, tutor name label — never for body text on white.

### Semantic tokens

| Semantic token | Maps to | Use |
|---|---|---|
| `--color-bg` | `--paper-50` | page background |
| `--color-surface` | `--paper-0` | cards, sheets |
| `--color-surface-sunken` | `--paper-100` | transcript panel |
| `--color-text` | `--ink-900` | |
| `--color-text-muted` | `--ink-600` | |
| `--color-border` | `--ink-300` | |
| `--color-primary` | `--iris-500` | mic orb, primary buttons, links |
| `--color-primary-pressed` | `--iris-700` | |
| `--color-on-primary` | `--paper-0` | |
| `--color-recording` | `--rose-500` | recording state only |
| `--color-success` / `--color-success-text` | `--leaf-500` / `--leaf-700` | try-again success, "Nice!" cards |
| `--color-fix-bg` / `--color-fix-accent` | `--amber-100` / `--amber-600` | correction "Fix" card |
| `--color-alt-bg` / `--color-alt-accent` | `--sky-100` / `--sky-600` | "More natural (optional)" card |
| `--color-celebrate` | `--sun-500` | confetti, badges |
| `--color-tutor` | per tutor accent | set on the conversation route |
| `--color-focus` | `--iris-500` | 3 px focus ring |

All text/background pairs used for text must meet WCAG AA (4.5:1 body, 3:1 large text / UI components). Verify with an automated contrast check in CI ([13](13-testing-and-evaluation.md)).

## A3. Typography

| Role | Font (all free, Google Fonts via `next/font`) | Size / line-height (mobile → desktop) | Weight |
|---|---|---|---|
| Display (headlines) | **Baloo 2** | 28/34 → 40/48 | 700 |
| Title | Nunito | 20/28 → 24/32 | 800 |
| Body | Nunito | 16/24 | 500 |
| Body small / meta | Nunito | 14/20 | 500 |
| Caption / labels | Nunito | 12/16 | 700, +2% tracking |
| Japanese text | **M PLUS Rounded 1c** (fallback Noto Sans JP) | body 18/30 (larger for kanji legibility); ruby `rt` 10–11 px | 500 |
| Devanagari (Hindi translations) | Noto Sans Devanagari | 16/26 | 500 |

- Transcript tutor/learner text uses **18 px** minimum on mobile (it's the learning content).
- Load Japanese and Devanagari fonts **only on routes that need them** (`next/font` per-route). Google Fonts serves CJK fonts as unicode-range slices, so only glyphs used are downloaded — verify in Phase 2 network traces.
- `font-feature-settings: "palt"` off for Japanese body text (keep fixed-width kana for learners).

## A4. Spacing, layout, shape

- **Spacing scale (4 px base):** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
- **Radii:** `--radius-sm 8px` (chips), `--radius-md 16px` (cards, bubbles), `--radius-lg 24px` (sheets, modals), `--radius-full` (mic orb, avatars, pills).
- **Elevation:** `--shadow-1: 0 1px 2px rgba(28,27,46,.06), 0 2px 8px rgba(28,27,46,.06)`; `--shadow-2: 0 4px 16px rgba(28,27,46,.10)`; mic orb glow `0 0 0 8px color-mix(in srgb, var(--color-primary) 18%, transparent)`.
- **Layout:** mobile single column, 16 px side gutters, max content width 1120 px on desktop. Bottom control bar 88 px + safe-area inset.

### Breakpoints

| Name | Min width | Layout |
|---|---|---|
| `xs` | 0 | single column (designed at 360 px) |
| `sm` | 600 px | single column, larger avatar stage |
| `md` | 900 px | conversation becomes 2 columns (avatar left, transcript right) |
| `lg` | 1280 px | wider margins, dashboard 3-column grid |

## A5. Components

| Component | Spec |
|---|---|
| **Button** | Heights 48 (default) / 40 (compact); radius `md`; variants: Primary (iris fill), Secondary (white + iris border), Ghost, Danger (rose outline — only for destructive actions). Press: scale 0.97 + darken, 120 ms. Disabled: 40% opacity, no shadow. |
| **Mic orb** | 72 px circle (80 px on ≥ md), iris fill + glow; icon 32 px. States per [02 §5.3](02-user-journeys-and-ux.md). Recording: rose fill, white stop-square, animated waveform ring (amplitude-driven, 8 bars). |
| **Chip** | 36 px height, radius `sm`, used for topics, goals, strictness. Selected: iris-50 fill + iris border + check icon. |
| **Transcript bubble** | Tutor: left-aligned, white surface, tutor-accent 3 px left border, name label. Learner: right-aligned, iris-50 surface. Controls row (Replay, Slow, Translate) as 32 px icon buttons with labels on desktop. Current spoken sentence highlighted with a soft accent underline. |
| **Correction card** | Inline under the learner bubble. Fix: amber-100 background, amber-600 left bar, 💡 icon, diff line, 1-line explanation, actions. More natural: sky colours, "Optional" tag. Nice!: leaf colours. Max width = bubble width. |
| **Bottom sheet** | Hint sheet, confirm sheets: radius `lg` top corners, max 40% viewport height on conversation screen, drag handle, focus-trapped. |
| **Modal** | Only for blocking errors and destructive confirms. |
| **Progress ring** | Session timer in the top bar: 28 px ring, tutor accent stroke. |
| **Toast** | Bottom (above control bar), 4 s, polite live region. |
| **Skeleton** | paper-100 blocks with 1.2 s shimmer (static under reduced motion). |
| **Level badge** | Pill "A2 · estimate" with tooltip explaining the estimate. |

Build components with **Tailwind CSS v4** utility classes bound to the CSS variables above, plus **Radix UI primitives** (MIT) for accessible dialogs, sheets, toggles and tooltips. No heavyweight component library.

## A6. Motion principles

1. **Motion explains state.** Every animation corresponds to a state change (listening, thinking, speaking, success). No decorative looping animation except the avatar's idle.
2. **Fast UI, alive tutor.** UI transitions 120–200 ms (`cubic-bezier(.2,.8,.2,1)`); the avatar uses springier, slower motion (300–600 ms) to feel organic.
3. **Celebrate rarely.** Confetti/particles only at session end and objective achieved.
4. **Never animate text the learner is reading** (no typing effects on transcript — text appears per sentence, synced to audio).

| Token | Value |
|---|---|
| `--dur-fast` | 120 ms |
| `--dur-base` | 200 ms |
| `--dur-slow` | 320 ms |
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` |
| `--ease-spring` | spring(stiffness 260, damping 20) for avatar/mic scale |

**Reduced motion (`prefers-reduced-motion: reduce` or in-app setting):** avatar keeps blinking and lip-sync (they carry meaning), disables head sway/bounce/breathing scale and particles; UI transitions become opacity-only ≤ 150 ms; mic breathing animation off.

## A7. Sound & haptics

See [02 §8](02-user-journeys-and-ux.md). Sound files: ≤ 10 KB each (Opus/MP3), normalised to −20 LUFS, preloaded after first user gesture.

## A8. Iconography & illustration

- Icons: **Lucide** (ISC licence), 2 px stroke, rounded caps — matches rounded type.
- Illustration: topic backgrounds (optional MVP) flat-shaded with the same palette; no gradients heavier than 2 stops; drawn in the same style as the tutors.

---

# Part B — Avatar asset specification

This is the **contract** your drawings must satisfy so one shared animation controller can drive all three tutors. It is specific to the chosen technology (D-37): **a layered 2D SVG rig animated by our own TypeScript controller**, rendered inline in the page. Evidence and alternatives: [research notes §1–9](research/notes/avatar-lipsync-japanese-text.md).

## B1. Technology decision (summary)

| Option | Verdict | Why |
|---|---|---|
| **Layered inline SVG + own controller** | ✅ **Chosen** | $0, no licence, tiny (controller ≈ 5–8 KB gz, art ≤ 20 KB brotli), crisp at any DPR, debuggable, runs well on mid-range Android; authoring in any free vector tool. |
| Rive | Upgrade path | Best tool for rigged 2D, MIT runtimes, but shipping without the Rive splash requires Cadet (≈ $9/seat/mo annual, $17 monthly). Docs and pricing page conflict on free export — re-check before adopting. Runtime 314–849 KB gz wasm. |
| Lottie / dotLottie | Rejected | Runtime mouth swapping is awkward; good creation tools are paid or limited. |
| Spine | Rejected | Paid editor ($69+) and runtime licence. |
| Live2D | Rejected | Anime-raster style; "Expandable Application" clause is ambiguous for an AI avatar app; release licence admin. |
| VRoid + three-vrm (3D) | Rejected | Anime 3D look, 5–20 MB models + ≈ 220 KB gz runtime; poor fit for flat cartoon on budget phones. |
| AI avatar video providers | Rejected | Recurring per-minute cost, latency, less distinctive identity, no control over expressions. |

The controller implements a renderer-agnostic interface so a Rive (or other) renderer can replace SVG later without touching the conversation code:

```ts
type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'happy' | 'confused' | 'celebrating';
type VisemeId = 'rest' | 'mbp' | 'cons' | 'a' | 'i' | 'u' | 'e' | 'o' | 'fv' | 'l_th';
type VisemeTrack = { t: number /* ms from clip start */; v: VisemeId }[];

interface AvatarRenderer {
  setState(s: AvatarState): void;
  setExpression(e: ExpressionId, opts?: { fadeMs?: number }): void;
  setViseme(v: VisemeId, weight?: number): void;          // weight reserved for Rive/3D blends
  playVisemeTrack(track: VisemeTrack, clock: () => number): void; // clock = AudioContext time − outputLatency − userOffset
  blink(kind?: 'short' | 'long'): void;
  setReducedMotion(on: boolean): void;
  dispose(): void;
}
```

## B2. Asset tiers

### 1. Minimum viable avatar (required for the Phase 2 PoC — Japanese tutor only)

- One SVG file following §B3–B6 with: `rig`, `body`, `head`, both eyes (white, pupil, lid/closed), both brows, `mouth` with **all 10 mouth shapes**, `expr_neutral`, `expr_happy`, `expr_thinking`, `expr_confused`.
- One pose (front-facing, head-and-shoulders or half-body).
- Passes the automated validator (§B8).
- Portrait PNG (512×512) exported from the same art, for tutor cards and meta images.

### 2. Recommended production avatar (MVP launch — all three tutors)

Everything above, plus:
- `expr_encouraging`, `expr_celebrating`; optional mouths `mouth_smile`, `mouth_wide_smile`.
- `cheeks` (blush) group; `shadow` group (ground shadow).
- Character accent colour defined (used by UI ring pulse).
- Small-size variant check: the face must read clearly at 64 px (dashboard avatar) — simplify details if not.
- One topic background illustration per setting is optional (gradient fallback exists).

### 3. Optional advanced features (post-MVP)

- Arm gestures (`arm_l`, `arm_r` with pivots: wave, point, thumbs-up).
- Extra visemes (rounded-cons for ʃ, separate `r`) and eye-shape variants per emotion.
- Outfit/seasonal variants (swap `accessories`).
- Rive port of the same character (same IDs map to state-machine inputs).
- Dark-mode-friendly outline variant.

## B3. File format and canvas

| Rule | Value |
|---|---|
| Format | One plain SVG per character: `assets/avatars/src/{lang}-{name}.svg` → built to `public/avatars/{lang}-{name}.{hash}.svg` |
| Root | `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" id="avatar" data-contract="1">` — **no** `width`/`height`, **no** `<style>` block |
| Canvas | 512 × 512 (head-and-shoulders) or 512 × 640 (half-body); character centred; ~24 units padding for bounce/celebrate motion |
| Colours | Plain `fill="#RRGGBB"` presentation attributes; flat colours; ≤ 2 linear gradients total (prefer none) |
| Strokes | Convert to fills, or centre-aligned strokes only, constant width |
| Precision | 1 decimal place (2 for small facial features) |
| **Hybrid art (added 2026-10-23)** | One `<image href="/avatars/<name>-art.webp">` is allowed for a blank-face illustration inside `head_base` (no data: URIs); eyes, brows, cheeks and mouths stay vector so they animate. Source PNG in `assets/avatars/src/`, converted by `node scripts/avatar-art.mjs` (~75 KB). |
| **Forbidden** | `<text>`, a second `<image>` or any embedded raster, `<filter>` (no blur/drop-shadow), `<mask>`, `<pattern>`, `<foreignObject>`, `<script>`, external `<use>`, `mix-blend-mode`, `display="none"`, `opacity="0"`, more than 2 `<clipPath>` (eyes only) |

Hidden variants (inactive mouths/expressions) must be **visible in the source file**, stacked on top of each other — the runtime hides them with a class. (Hidden elements would be deleted by the optimiser.)

## B4. Required group hierarchy and IDs

IDs are lowercase snake_case, unique, matching `^[a-z][a-z0-9_]*$`. `_l`/`_r` are the **character's** left/right. Every character uses the **same IDs**. `*` = animated by the controller (must have a pivot, §B5).

```
avatar (svg root)
└─ rig                       * whole-body transform (bounce, celebrate jump)
   ├─ shadow                 ground shadow (optional in MVP)
   ├─ body                   * breathing (pivot: hips)
   │  ├─ torso
   │  ├─ arm_l, arm_r        static in MVP (reserved for gestures)
   └─ head                   * sway / nod / tilt (pivot: neck)
      ├─ head_base           face shape, back hair
      ├─ ear_l, ear_r        optional
      ├─ eyes
      │  ├─ eye_l
      │  │  ├─ eye_l_white
      │  │  ├─ eye_l_pupil   * saccades (may be clipped by eye_l_clip)
      │  │  ├─ eye_l_lid     * blink (scaleY from top of eye) — OR use eye_l_closed swap
      │  │  └─ eye_l_closed  closed-eye line for the blink peak
      │  └─ eye_r            (same children, _r)
      ├─ brows
      │  ├─ brow_l           * expression translate/rotate
      │  └─ brow_r           *
      ├─ cheeks              blush (opacity by expression)
      ├─ mouth               * container (small jaw translateY)
      │  ├─ mouth_rest  mouth_mbp  mouth_cons  mouth_a  mouth_i
      │  ├─ mouth_u     mouth_e    mouth_o     mouth_fv mouth_l_th
      │  └─ mouth_smile, mouth_wide_smile        (optional)
      ├─ expr                expression overlays
      │  ├─ expr_neutral  expr_happy  expr_thinking  expr_confused
      │  └─ expr_encouraging  expr_celebrating      (production tier)
      └─ hair_front, accessories   static, drawn last (on top)
```

## B5. Pivots

Each `*` group carries `data-pivot="x y"` in viewBox units, e.g. `<g id="head" data-pivot="256 300">` (head pivots at the neck, body at the hips, eyelids at the top edge of the eye, mouth at its centre). The controller sets `transform-origin` from it with `transform-box: view-box`. **Do not bake rotations into animated groups** (children may have transforms).

## B6. Mouth shapes (visemes)

Ten shapes — Rhubarb's cartoon set plus five distinct vowels, which suits Japanese's vowel-driven speech and maps cleanly from Azure viseme IDs, English/German phonemes and Japanese kana (mapping tables in [research notes §1.3–1.5](research/notes/avatar-lipsync-japanese-text.md)).

| ID | Draw | Typical sounds |
|---|---|---|
| `rest` | Lips closed, relaxed (slight smile OK) | silence, pauses |
| `mbp` | Lips pressed together | p b m; ま/ば/ぱ onsets; ん before m/b/p — **most visible cue, never skipped** |
| `cons` | Slightly open, teeth together/visible | t d n s z k g h; ch/sh; German ç x ʁ |
| `a` | Wide open, jaw dropped | a (あ), stressed ʌ |
| `i` | Spread, small opening, teeth visible | i (い), ɪ, y-glide |
| `u` | Small rounded pucker (subtle for Japanese う) | u (う), w, German ü |
| `e` | Mid open, slightly wide | e (え), ɛ, ə |
| `o` | Rounded, medium open | o (お), ɔ, German ö |
| `fv` | Upper teeth on lower lip | f v (not Japanese ふ) |
| `l_th` | Open like `e`, tongue tip visible | l, th |

Rules: all mouths centred on the same anchor, within a ~90 × 70-unit box, 3–6 paths each (outline, inner dark, teeth, tongue), identical line weight and colours. Provide a non-shipped reference sheet showing each shape beside example sounds.

**Runtime behaviour (for reference):** one mouth visible at a time; minimum hold 40–60 ms; one-frame in-between (`e` between closed→`a`, `o` between `a`→`u`); closures (`mbp`, `fv`) formed *at* audio onset with 30–50 ms look-ahead; mouth aims to be 0–40 ms early rather than late (lip-sync detectability ≈ +45/−125 ms).

## B7. States → required visuals

| State | Mouth | Expression | Idle modifiers (disabled under reduced motion except blink/lip-sync) |
|---|---|---|---|
| idle | `rest` / `smile` | `expr_neutral` | blink (log-normal interval, mean ~3.5 s, 15% double), breathing (~1.2% scaleY, 3.6 s), sway (±1.5°, two incommensurate sines) |
| listening | `rest` | `expr_neutral` + 4° head tilt | **short** blinks only; pupils centred on the learner |
| thinking | `rest` / small `u` | `expr_thinking` | pupils up-left, slower sway |
| speaking | viseme track | current expression | small nods on audio stress peaks |
| happy / encouraging | `smile` | `expr_happy` / `expr_encouraging` | — |
| confused | small `o` | `expr_confused` | head tilt 6°, one long blink |
| celebrating | `wide_smile` / `a` | `expr_celebrating` | rig jump + shadow squash |

Expression changes cross-fade on opacity (120–180 ms) or swap during a blink.

## B8. Export & build pipeline

1. **Author** in Figma (free), Inkscape or Affinity (free for individuals) using the exact IDs. Krita can't export multi-layer SVG — use it only for sketches.
   - Figma: name layers with valid IDs; export SVG with **"Include 'id' attribute"** and **"Outline text"**; disable "Clip content" on frames; avoid masks.
   - Inkscape: set each group's **ID** (Object Properties / XML editor), not just its label — plain-SVG export drops labels. (The build script can also copy `inkscape:label` → `id`.)
2. **Build** (`npm run avatars:build`): normalise IDs → SVGO with the rig-safe config (below) → validator → emit hashed SVG + manifest JSON (IDs, pivots, byte size, element count).

```js
// svgo.config.mjs — rig-safe (default preset would delete hidden mouths and rename IDs)
export default {
  multipass: true,
  floatPrecision: 1,
  plugins: [
    { name: 'preset-default', params: { overrides: {
      cleanupIds: false, removeHiddenElems: false, collapseGroups: false,
      moveGroupAttrsToElems: false, moveElemsAttrsToGroup: false, mergePaths: false,
      removeUnknownsAndDefaults: { keepDataAttrs: true, keepRoleAttr: true },
    } } },
    'removeDimensions',
    { name: 'removeAttrs', params: { attrs: ['serif:id', 'data-name'] } },
  ],
};
```

## B9. Budgets

| Per character | Target | Hard cap |
|---|---|---|
| SVG minified | ≤ 60 KB | 120 KB |
| SVG brotli | ≤ 20 KB | 40 KB |
| Total elements / `<path>` | ≤ 250 / ≤ 150 | 400 / 250 |
| Path commands | ≤ 3,000 | 6,000 |
| Animated groups | ≤ 12 | 20 |
| Avatar frame cost (mid-range Android, 4× CPU throttle) | ≤ 2 ms avg | 4 ms |
| Avatar visible after first paint (Slow 4G) | ≤ 1.0 s | 2.0 s |

Delivery: the active tutor's SVG is inlined into the server-rendered conversation page (it's the LCP element); other tutors are fetched at idle; all are immutable, content-hashed and precached by the service worker.

## B10. Validation steps (run these before handing over a character)

Automated (`npm run avatars:validate`, also in CI):

- [ ] Root has `viewBox` and `data-contract="1"`, no width/height.
- [ ] All required IDs from §B4 present for the tier; IDs unique and valid.
- [ ] All 10 required `mouth_*` groups present and non-empty.
- [ ] Every animated group has a `data-pivot` inside the viewBox.
- [ ] No forbidden elements/attributes; clipPaths ≤ 2, gradients ≤ 2.
- [ ] No `display="none"` / `opacity="0"` in source.
- [ ] Size and element budgets (§B9).
- [ ] Visual regression: Playwright screenshot per state and per viseme vs approved baselines.
- [ ] Performance smoke: cycle all visemes at 30 fps under 4× CPU throttle ≤ 4 ms/frame.

Manual (5 minutes, in the dev "Avatar Lab" page `/dev/avatar`):

- [ ] Step through every mouth shape — each reads clearly at 160 px and 64 px.
- [ ] Play the 3 sample lines (ja/de/en) with their viseme tracks — mouth matches speech, `mbp` closures visible.
- [ ] Trigger every state and expression; transitions don't pop or misalign (check pivots).
- [ ] Toggle reduced motion — only blink and lip-sync remain.
- [ ] Check on a real mid-range Android phone and an iPhone.

## B11. Licensing & commercial use

- You own the character art; keep source files and a written note of authorship (and contracts if you commission an artist — require full commercial rights and transfer of source files).
- Don't base characters on existing IP (including Duolingo's characters) or on real people.
- Fonts used inside art must be converted to paths (no font licensing in the SVG).
- Third-party code: SVGO (MIT), optional Motion (MIT) or GSAP (free "No Charge" licence — fine for this app, not open source); Rhubarb (MIT) for build-time lip-sync of fixed lines; CMUdict (BSD-style) for English phoneme lookup. Avoid bundling eSpeak-NG/phonemizer.js (GPL-3.0) in the client.
