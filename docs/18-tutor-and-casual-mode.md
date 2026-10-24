# 18 — Tutor mode and Casual mode

> Status: implemented 2026-10-25 · Owner request after real-use testing · Related: [06 Tutor behaviour](06-ai-tutor-behavior.md), [07 State machine](07-conversation-state-machine.md)

## Why

Real use showed that a tutor which silently understands and moves on feels like an interview, not a lesson. Learners differ: some want every
mistake fixed, others just want to talk. So the learner chooses, and **Tutor is the default**.

## Behaviour

| | Tutor (default) | Casual |
|---|---|---|
| Spoken fix of a wrong, unfinished or unnatural sentence ("「…」と言うといいですよ") | Yes, before the reply | Never |
| Correction cards (verified, 2-of-3 vote) | Yes, strictness `strict` (every severity, style tips too) | None |
| Conversation (react, share something, one follow-up question) | Yes | Yes |
| Hints, "Did you say …?" checks, summary | Yes | Yes (summary has no "worth fixing" for turns spoken in Casual) |

Switch any time: the pill in the header during a conversation, or the toggle on the start screen. The choice is remembered on the device
(`localStorage: lactice.coachMode`) and is sent when the session is created; changing it mid-session calls `PATCH /api/sessions/{id}`.

## How it works

1. `SessionRecord.coachMode` (`tutor` | `casual`). Default strictness is now `strict`.
2. Prompt (`turn@3`): the static prefix lists the error codes and tutoring rules; the dynamic part says `Mode: TUTOR` or `Mode: CASUAL`
   (casual → `recast_candidate` and `recast` must be null).
3. Code decides, not the model: in Casual `allowCorrections` is false, so no spoken fix, no detection calls, no cards.
4. Spoken fix gate (`fastPathRecastAllowed`): known error code, text really heard, no low-confidence word near it, particles only if every word
   involved has confidence ≥ 0.85, severity ≥ 1 in strict. New codes: `ja.sentence.incomplete`, `ja.phrasing.unnatural`
   (grammatical but not what a native would say, e.g. 私はおにぎりがおいしいです → おにぎりはおいしいです). `ja.particle.wa_ga` is now fast-path eligible.
5. The verified card pipeline does not see the two new codes (the live turn call handles them).

## Measured (20 seed sentences + 4 extra, gpt-5.6-luna)

Spoken fixes in Tutor/strict: 7 of 9 real errors fixed aloud; 1 of 15 valid sentences changed (a tense change that fits the question's past
context). Casual: 0 by construction (tested). Card pipeline unchanged: 0% false corrections, recall 63–100% run to run (n = 8, noisy).

## Open

- A teacher must review the taxonomy, especially `ja.phrasing.unnatural` and `ja.particle.wa_ga`, before launch.
- Per-session reports ("This was wrong") should feed an automatic switch-off of noisy codes (docs/06 §11), not built yet.
