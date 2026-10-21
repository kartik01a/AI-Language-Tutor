# Lactice

AI voice language tutor (Japanese, German, English). Plan and research live in [`docs/`](docs/README.md).

```bash
npm install
npm test          # unit tests (dialogue machine, correction gates, config)
npm run typecheck
npm run dev
```

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

Built: dialogue machine, correction gates, turn pipeline, prompts, budget kill switch, session service,
streaming API, avatar + audio engine, Supabase migration, demo conversation screen.
Not built yet (needs your keys/assets): real Deepgram/OpenAI/Azure adapters, Postgres store, auth, onboarding,
dashboard, correction cards, end-of-session summary. The runtime refuses to start in production until real
providers and auth exist.
