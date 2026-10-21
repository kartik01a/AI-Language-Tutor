# Lactice

AI voice language tutor (Japanese, German, English). Plan and research live in [`docs/`](docs/README.md).

```bash
npm install
npm test          # unit tests (dialogue machine, correction gates, config)
npm run typecheck
npm run dev
```

## Try it with the REAL providers (speak Japanese to Yuki)

Put your keys in `.env.local` (see `.env.example`), then:

```bash
npm run dev:real     # same as PROVIDERS=real next dev; open http://localhost:3000/practice and allow the microphone
```

The screen tells you which mode you are in: an amber **Demo mode** banner means scripted answers and beep sounds
(no real voice); no banner means live Deepgram + OpenAI + Azure.

This spends real money (≈ $0.002 per turn). There is **no authentication yet**, so the server refuses to run in
production. Real-provider scripts: `scripts/probe-azure.mjs`, `probe-deepgram.mjs`, `probe-openai.mjs`,
`real-session.mjs`, `eval-corrections.mjs` — run with
`node --env-file=.env.local node_modules/.bin/tsx scripts/<name>.mjs`. Measurements: `docs/research/notes/phase0-measurements.md`.

## Compare speech recognisers on YOUR voice

```bash
npm run dev:real                       # then open http://localhost:3000/dev/record
# record the 20 phrases (saved only on this computer, git-ignored), then:
node --env-file=.env.local node_modules/.bin/tsx scripts/eval-stt.mjs <your-name>
```

Compares Deepgram (ja and multi), Azure ja-JP and OpenAI gpt-transcribe on accuracy, confidence and how often our gates
would accept / ask "Did you say …?" / reject. `scripts/make-synthetic-clips.mjs` creates a dry-run speaker.

## Try the demo conversation (no API keys)

```bash
npm run dev            # then open http://localhost:3000/practice
```

A scripted Yuki (beep voice, fixed learner script) runs the real pipeline: dialogue machine, gates,
streaming protocol, recorder, gapless player and lip-sync. Other dev pages: `/dev/avatar`, `/dev/audio`.

Browser checks (need a running dev server and Google Chrome):

```bash
node scripts/e2e-conversation.mjs http://localhost:3000
node scripts/cdp-eval.mjs "http://localhost:3000/dev/audio?auto=1" "document.querySelector('#result')?.textContent.includes('done') && document.querySelector('#result').textContent"
```

## Status

Built: dialogue machine, correction pipeline + cards, spoken recast, turn pipeline, prompts, budget kill switch,
session service, streaming API, avatar + audio engine, Supabase migration, demo conversation screen,
end-of-session summary (verification pass, quoted praise, provisional level update),
**real Deepgram / OpenAI / Azure adapters** (hedged requests, schema warm-up, parallel TTS).
Not built yet: Postgres store, auth, onboarding,
dashboard, trial/waitlist screens, "Try again" recording on cards, replay/slow replay buttons. The runtime refuses to start in production until real
providers and auth exist.
