# Lactice

A voice language tutor for Indian adult learners. You speak, a cartoon tutor listens, answers out loud and
corrects you only when it is confident you made a real mistake.

- **Japanese with Yuki** works today.
- German (Lena) and English (Sam) are planned.
- Product plan, research and decisions: [`docs/`](docs/README.md).

How a turn works: your browser records your voice → speech-to-text (Deepgram) → the tutor's reply and analysis (OpenAI) →
text-to-speech with mouth shapes (Azure) → the avatar speaks and lip-syncs. Code, not the AI, decides when to retry, hint or correct.

---

## 1. Quick start (no API keys, 2 minutes)

Just want to see the app's flow? Demo mode uses a scripted tutor with beep sounds instead of a voice.

```bash
git clone https://github.com/kartik01a/AI-Language-Tutor.git
cd AI-Language-Tutor
npm install
npm run dev
```

Open <http://localhost:3000/practice> and allow the microphone. An amber **Demo mode** banner is shown.

**Requirements:** Node.js 22 or newer, npm, and Google Chrome (or Safari/Edge) with a microphone.

---

## 2. Have a real conversation with Yuki

You need three API keys. Everything stays on your computer: keys live in `.env.local`, which git ignores.

### Step 1: Create the keys

| Service | What it does | Where to get a key |
|---|---|---|
| **Deepgram** | Turns your speech into text | <https://console.deepgram.com> → API Keys (new accounts get free credit) |
| **OpenAI** | Writes the tutor's replies, translations and corrections | <https://platform.openai.com/api-keys> (needs a few dollars of credit) |
| **Azure Speech** | Gives Yuki her voice and mouth timing | <https://portal.azure.com> → create a **Speech** resource (free tier F0 is enough) → *Keys and Endpoint*. Copy **KEY 1** and the **Location/Region** (for example `centralindia`) |

### Step 2: Create `.env.local`

In the project folder:

```bash
cp .env.example .env.local
```

Open `.env.local` and uncomment and fill in these lines (keep the rest as is):

```bash
PROVIDERS=real

DEEPGRAM_API_KEY=your-deepgram-key
OPENAI_API_KEY=your-openai-key
AZURE_SPEECH_KEY=your-azure-key
AZURE_SPEECH_REGION=centralindia     # the region shown in Azure

# optional: change the LLM (default gpt-5.6-luna)
# OPENAI_MODEL_TURN=gpt-5.6-luna
```

Never paste keys into chat, issues or commits. `.env.local` is already git-ignored.

### Step 3: Run it

```bash
npm run dev:real
```

Open <http://localhost:3000/practice>, press **Start talking with Yuki**, and allow the microphone. Yuki greets you and
offers topics. Tap the mic, speak, and tap again to send.

How to tell which mode you are in: an amber **Demo mode** banner means scripted answers and beeps. No banner means the
real providers are running (and costing money, roughly $0.002 per turn, about $0.05 for a 5-minute session).

**Tips**
- Use headphones if you can, so Yuki's voice isn't picked up by your mic.
- Speak a full short sentence. Single words often get a "Did you say …?" check.
- Rejections and gate decisions print in the terminal as `[turn] {...}` lines. In development, an unclear message also shows a small grey "Why:" line.

---

## 3. Configuration

All settings are environment variables in `.env.local`. Defaults are in [`.env.example`](.env.example).

| Variable | Default | Meaning |
|---|---|---|
| `PROVIDERS` | demo | `real` = Deepgram + OpenAI + Azure, anything else = demo |
| `SESSION_TARGET_MINUTES` | 5 | Soft time limit: the tutor finishes the exchange, then wraps up |
| `SESSION_GRACE_SECONDS` | 120 | Extra time allowed after the soft limit |
| `TRIAL_LIMIT_ENABLED` / `TRIAL_LIMIT_MINUTES` | true / 5 | Free-trial limit (one-time per account, not enforced until accounts exist) |
| `AI_MONTHLY_BUDGET_USD` | 50 | Spending kill switch |
| `UNCLEAR_MAX_RETRIES` | 1 | "Didn't catch that" retries before the tutor suggests what to say |
| `SILENCE_HINT_PULSE_SECONDS` / `SILENCE_NUDGE_SECONDS` | 10 / 25 | Silence timing |
| `MAX_RECORDING_SECONDS` | 30 | Longest single answer |

---

## 4. Useful commands

```bash
npm run dev          # demo mode (no keys)
npm run dev:real     # real providers
npm test             # unit tests
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm run avatars:validate   # check the avatar SVG against the asset contract
node scripts/avatar-art.mjs   # rebuild the avatar image after changing assets/avatars/src/*.png
```

Dev-only pages (disabled in production builds):
`/dev/avatar` (animate every state and mouth shape), `/dev/audio` (audio self-test), `/dev/record` (record test phrases).

### Compare speech recognisers on your voice

Record the 20 test phrases at <http://localhost:3000/dev/record> (saved only on your computer under `eval/audio/`,
git-ignored), then:

```bash
node --env-file=.env.local node_modules/.bin/tsx scripts/eval-stt.mjs <your-name>
```

This compares Deepgram, Azure and OpenAI transcription on accuracy and confidence. It does not train anything.

### Other real-provider scripts

`scripts/probe-azure.mjs`, `probe-deepgram.mjs`, `probe-openai.mjs`, `real-session.mjs`, `eval-corrections.mjs`. Run with
`node --env-file=.env.local node_modules/.bin/tsx scripts/<name>.mjs`. Results so far: `docs/research/notes/phase0-measurements.md`.

### Browser end-to-end check (needs `npm run dev` running and Chrome)

```bash
node scripts/e2e-conversation.mjs http://localhost:3000
```

---

## 5. Project layout

```
app/                 Next.js pages and API routes (/practice, /api/sessions/...)
components/          Conversation screen, avatar, UI shell
lib/tutor/           Dialogue machine, gates, prompts, correction pipeline (pure, unit-tested)
lib/providers/       Deepgram, OpenAI, Azure adapters and the scripted demo providers
lib/session/         Session service and store
lib/avatar/          Avatar contract validator and animation controller
lib/audio/           Recorder, voice-activity detection, gapless player
assets/avatars/src/  Tutor art (SVG + illustration)
supabase/migrations/ Database schema (not wired up yet)
docs/                Product blueprint, research, decisions, risks
eval/                Test sets and reports
```

## 6. Status and limits

Built: Japanese conversation end to end (listening, spoken replies with English lines, "Did you say …?" confirmation,
hints, corrections you can verify, end-of-session summary), avatar with lip-sync, cost limits, 359 unit tests.

Not built yet: accounts and sign-in, a real database store (sessions live in memory), onboarding, dashboard,
trial and waitlist screens, German and English tutors. Because there is no authentication, **the server refuses to start in
production mode**. Run it locally only.

Known: time to the first spoken word is about 3.5 seconds on a laptop (target 2.5 s), and recognition of accented
Japanese is being tuned. See [`docs/17-risks-and-open-decisions.md`](docs/17-risks-and-open-decisions.md).

## Privacy

Your voice is sent to Deepgram, OpenAI and Azure to run the conversation (Deepgram is called with its "don't use my data
for training" option). Nothing is stored by the app yet except in server memory. Test recordings you make with
`/dev/record` stay in `eval/audio/` on your machine.
