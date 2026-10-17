# 15 — Deployment & Operations

> Related: [09 Architecture](09-system-architecture.md) · [12 Cost](12-cost-and-performance-model.md) · [14 Security](14-security-and-privacy.md) · Evidence: [infra notes](research/notes/infra-browser-privacy.md)

Target: a solo developer can deploy in one command, sleep through the night, and never get a surprise bill.

---

## 1. Environments

| Env | Hosting | Database | Providers | Purpose |
|---|---|---|---|---|
| `local` | `next dev` | Supabase local (Docker) or a dev project | real keys with low limits, or fakes (`PROVIDERS=fake`) | development |
| `staging` | Cloud Run service `lactice-staging` (min 0, max 1) | Supabase project #1 (Free) | real, Azure **F0**, separate OpenAI project with low monthly limit | pre-release, eval runs |
| `production` | Cloud Run service `lactice-prod` (min 0, max 3) | Supabase project #2 (Free → **Pro at public launch**) | real, Azure **S0** | users |

Supabase Free allows 2 active projects — exactly staging + prod. Keep both active (weekly keep-alive job) to avoid the 7-day pause.

---

## 2. Environment variables

Server-only unless prefixed `NEXT_PUBLIC_`. Product limits are documented in [01 §6](01-product-requirements.md).

| Variable | Example / default | Notes |
|---|---|---|
| `NEXT_PUBLIC_APP_NAME` | `Lactice` | brand (D-35) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | — | client auth + RLS reads |
| `SUPABASE_SERVICE_ROLE_KEY` | secret | server writes |
| `OPENAI_API_KEY`, `OPENAI_MODEL_TURN` | `gpt-6-luna` (pin snapshot when available) | |
| `OPENAI_MODEL_ANALYSIS`, `OPENAI_REASONING_ANALYSIS` | `gpt-6-luna`, `low` | |
| `ANTHROPIC_API_KEY`, `LLM_FAILOVER` | `claude-haiku-5-5`, `true` | failover peer |
| `STT_PROVIDER` | `deepgram` | `deepgram \| scribe \| azure \| openai` |
| `DEEPGRAM_API_KEY`, `DEEPGRAM_MODEL` | `nova-3` | `mip_opt_out=true` always set in code |
| `STT_SECOND_OPINION` | `false` | Groq Whisper on borderline clips |
| `TTS_PROVIDER` | `azure` | `azure \| elevenlabs` |
| `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | `centralindia` (verify voice availability) | |
| `TRIAL_LIMIT_ENABLED`, `TRIAL_LIMIT_MINUTES` | `true`, `5` | D-31 |
| `SESSION_TARGET_MINUTES`, `SESSION_GRACE_SECONDS` | `5`, `120` | D-20 |
| `AI_MONTHLY_BUDGET_USD` | `50` | D-10 |
| `SILENCE_HINT_PULSE_SECONDS`, `SILENCE_NUDGE_SECONDS` | `10`, `25` | D-26 |
| `UNCLEAR_MAX_RETRIES` | `1` | D-17 |
| `MAX_RECORDING_SECONDS`, `MIN_SPEECH_MS` | `30`, `400` | |
| `IDLE_PAUSE_SECONDS`, `RECONNECT_WINDOW_SECONDS` | `90`, `120` | |
| `TRIAL_ACCOUNTS_PER_IP_PER_DAY` | `3` | |
| `CLASSIFIER_SAMPLES`, `CORRECTION_SAMPLES` | `1`, `3` | 06 §4.2, §6 |
| `POLICY_SINGLE_CALL` | `true` | 06 §5 |
| `ASR_THRESHOLDS_JSON` | per lang × provider τ values | from calibration |
| `IP_HASH_SECRET` | secret | HMAC for IP hashes |
| `ADMIN_EMAILS` | comma list | |
| `SENTRY_DSN`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | — | |
| `CRON_AUDIENCE` | — | OIDC audience for scheduler calls |
| `PRICE_TABLE_VERSION` | `2026-10-14` | cost accounting |

All secrets live in **GCP Secret Manager**, mounted as env vars on the Cloud Run revision. `.env.example` in the repo lists every variable with comments.

---

## 3. Container & Cloud Run configuration

- `next.config.ts`: `output: 'standalone'`, `deploymentId` set from the git SHA, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` from secrets (multi-instance safety).
- Dockerfile: multi-stage, `node:22-slim`, copies `.next/standalone`, `.next/static`, `public`, and the kuromoji dictionary; runs as non-root; `HOSTNAME=0.0.0.0`.
- Cloud Run service:

| Setting | Value | Why |
|---|---|---|
| Region | `asia-south1` (Mumbai, Tier 1 pricing) | latency, data in India |
| CPU / memory | 1 vCPU / 1 GiB | Japanese analyzer ≈ 430 MB RSS |
| Concurrency | 40 | streaming turns are I/O-bound |
| Min / max instances | 0 / 3 (prod) | cost guard; set min 1 only for demos (≈ $10/month idle) |
| Request timeout | 300 s | turns ≤ 30 s; session end analysis ≤ 60 s |
| Billing | request-based (switch to instance-based > ~5k MAU) | [12 §8](12-cost-and-performance-model.md) |
| Startup CPU boost | on | faster cold starts |
| Ingress | all; HTTPS only | |
| Spend cap | Cloud Billing spend-cap budget ≈ $25 on the project + alert budgets at 50/80/100% | bill-shock protection |

Cold-start hiding: the client sends `GET /api/warm` when the conversation screen opens and again when the mic opens.

Artifact Registry: keep ≤ 3 images (cleanup policy) to stay within 0.5 GB free.

---

## 4. CI/CD (GitHub Actions)

```mermaid
flowchart LR
    PR[Pull request] --> L[lint + typecheck]
    L --> U[unit + contract + integration tests]
    U --> A[avatar validate + a11y + E2E (Playwright, fake mic)]
    A --> B[next build]
    B --> OK[PR checks green]
    M[merge to main] --> IMG[build & push image] --> MIG[supabase db push → staging] --> DS[deploy staging] --> SM[smoke tests + eval subset]
    T[git tag vX.Y.Z] --> MIGP[supabase db push → prod] --> DP[deploy prod (traffic 100% after health check)] --> SMP[prod smoke]
```

- Workload Identity Federation from GitHub to GCP (no long-lived JSON keys).
- Nightly workflow (staging): eval subset (§13 datasets, ~$0.50/night), voice regression, Supabase `db dump` backup of prod while on Free (encrypted artifact, 7-day retention).
- Rollback: `gcloud run services update-traffic --to-revisions=<previous>=100`; DB migrations are forward-only and backward-compatible for one release (expand → migrate → contract).
- Build minutes: GitHub Actions free 2,000 min/month (private) — keep E2E to Chromium + WebKit, cache dependencies.

---

## 5. Scheduled jobs (Cloud Scheduler → authenticated HTTP)

| Job | Schedule | Endpoint |
|---|---|---|
| Purge expired opt-in audio | daily 02:00 IST | `/api/cron/purge-audio` |
| Erasure queue (account deletions, processor deletions) | hourly | `/api/cron/erasure` |
| Supabase keep-alive (Free projects) | daily | `/api/cron/keepalive` |
| Close stale sessions (suspended > reconnect window) | every 10 min | `/api/cron/close-sessions` |
| Monthly spend reset check & report | 1st of month | `/api/cron/spend-report` |

(Cloud Scheduler free tier: 3 jobs per billing account — combine into one `/api/cron/tick` dispatcher if needed.)

---

## 6. Monitoring & alerting

| Signal | Source | Alert |
|---|---|---|
| AI spend vs budget | `monthly_spend` | email at 50 / 80 / 100% (app) |
| Cloud spend | GCP budgets | email at 50 / 80 / 100%; spend cap pauses Cloud Run |
| Provider error rate | turn logs | > 5% over 15 min → email |
| Turn latency p90 | turn logs | > 5 s over 30 min → email |
| Unclear rate | turns | > 25% of turns in a day → investigate thresholds/provider |
| Correction report rate | corrections | > 3 per 100 cards → review; auto-disable rule at > 10% per category |
| Errors | Sentry | new issue → email |
| Uptime | Sentry uptime monitor (1 free) on `/api/health` | down 2 checks → email |
| Deepgram credit remaining | weekly manual check / API | < $25 → plan switch |

---

## 7. Runbooks (create in Phase 6 under `docs/runbooks/`)

| Runbook | Trigger | Key steps |
|---|---|---|
| Provider outage | provider error alert | flip `STT_PROVIDER` / `LLM_FAILOVER` / (TTS: text-only mode flag) via env update → new revision; status banner |
| Budget exhausted | 100% alert | confirm kill switch active; decide: raise `AI_MONTHLY_BUDGET_USD` or wait; message waitlist |
| Latency regression | p90 alert | check per-stage trace; region status; consider Fast mode / min instances |
| Bad prompt release | quality drop / report spike | roll back prompt version flag (prompts are versioned; config switch, no redeploy) |
| Data breach | suspicion | [14 §6](14-security-and-privacy.md) |
| Supabase paused / quota | 402/paused errors | resume project; upgrade to Pro |
| Model deprecation notice | provider email | run full eval on replacement in staging; switch pinned id |

---

## 8. Operating cost controls (summary)

1. App kill switch (`AI_MONTHLY_BUDGET_USD`).
2. Provider-side monthly limits (OpenAI project limit, Azure budget alert, Deepgram credit).
3. Cloud Run spend cap + `max-instances`.
4. Supabase spend cap (on by default on Pro).
5. Trial per account + rate limits + per-session turn cap.
