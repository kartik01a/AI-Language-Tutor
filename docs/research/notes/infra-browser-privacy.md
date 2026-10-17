# Infrastructure, Browser Audio and Privacy (DPDP): Research Notes

*Planning-phase research for the AI voice language-tutor web app. Researched 2026-10-14. Every fact carries a label and a source.*

**Labels**
- **VERIFIED**: read on an official or primary source (vendor docs/pricing page, Gazette text, MDN browser-compat-data, WebKit blog).
- **REPORTED**: from a secondary source (law-firm note, third-party test page, bug tracker, blog).
- **ESTIMATE/ASSUMPTION**: my own calculation or assumption. The inputs are stated.

All URLs were accessed on **2026-10-14** unless noted otherwise. Prices are in USD and exclude GST/VAT. The numbered source list is in [Sources](#sources), and in-text references look like [S1].

---

## TL;DR (decision-relevant)

1. **Cloud Run in Mumbai (asia-south1) works and is a Tier-1 (cheapest) region.** It supports streaming (chunked/SSE), WebSockets and a 60-min timeout, and the free tier applies there. The catch is that request-based billing charges **wall-clock time while a request is open**. Our turns spend most of their time waiting on STT/LLM/TTS, so Cloud Run compute grows with conversation time. Rough figures are $0 at 100 MAU, about $13–19/mo at 1,000 MAU and about $45–60/mo at 10,000 MAU (ESTIMATE). Spend caps for Cloud Run went GA in Oct 2026 and help prevent bill shock.
2. **Cloudflare Workers Free has a 10 ms CPU limit per request**, which is too tight for Next.js SSR. Workers Paid costs $5/mo, bills **CPU time, not wall time**, and has no egress fees, so it is far cheaper at scale. The cost is adapter risk: OpenNext (`@opennextjs/cloudflare` 1.20.x) works, but Cloudflare's own Next.js guide now promotes its **vinext** reimplementation, which is beta. The two sources disagree on the Worker size limit.
3. **Vercel Hobby is non-commercial only** (VERIFIED). Render Free says "do not use for production". Fly.io has no free tier for new orgs.
4. **Supabase Free**: 500 MB DB, 1 GB storage, 5 GB egress, 50k MAU, **paused after 1 week of inactivity, no backups**. Mumbai (ap-south-1) is available. Plan on **Pro ($25/mo)** at commercial launch, or roughly when the 1,000-MAU mark is reached.
5. **Browser audio.** iOS Safari 18.4+ records WebM/Opus. Older iOS records MP4/AAC. Feature-detect the format. iPhone has no classic MSE, only ManagedMediaSource (17.1+). For v1, the most robust approach is **per-sentence complete MP3 chunks decoded and scheduled with Web Audio**, plus an `<audio>` element with `preservesPitch` for "Slow" replay. Do not stream raw PCM, which uses about 6× the bandwidth of MP3 64 kbps.
6. **DPDP.** The Rules were notified **13 Nov 2025**. Consent-manager rules start **13 Nov 2026**, and **all substantive duties (notice, security, breach, children, rights, retention) start 13 May 2027**. A proposal to cut this to 12 months is reported but not notified. **Surprise:** Rule 8(3) requires keeping personal data, traffic data and processing logs for **at least 1 year** from processing, "even if X deletes her account". This collides with our "delete history/account" promise and needs a legal read. A child is anyone **under 18**, so an 18+-only product needs a robust age gate. The law prescribes no specific method for adult-only services.
7. **Budget risk.** At 1,000 MAU, infrastructure alone could use $15–45 of the $50/mo budget, depending on Supabase Free vs Pro, **before any AI costs**. The $50 total does not look sustainable beyond a few hundred active users (ESTIMATE).

---

## 1. Google Cloud Run

### 1.1 Free tier and pricing

| Item | Value | Label | Source |
|---|---|---|---|
| Free tier, **request-based billing** | 180,000 vCPU-s, 360,000 GiB-s, **2 million requests**/month | VERIFIED | [S1] |
| Free tier, **instance-based billing** | 240,000 vCPU-s, 450,000 GiB-s/month (no request allowance) | VERIFIED | [S1] |
| How the free tier is applied | "aggregated across projects by billing account and resets every month… applied as a spending based discount using Tier 1 pricing" | VERIFIED | [S1] |
| Is asia-south1 (Mumbai) Tier 1? | **Yes.** asia-south1 (Mumbai) is listed under "Subject to Tier 1 pricing". asia-south2 (Delhi) is Tier 2. | VERIFIED | [S1] |
| Regional restriction on Cloud Run free tier | None stated. The Free Tier page restricts Cloud Storage and Compute Engine e2-micro to US regions but sets no region restriction for Cloud Run, Artifact Registry or Cloud Build. | VERIFIED | [S2] |
| Request-based price (Tier 1, default) | CPU **$0.000024**/vCPU-s active, **$0.0000025**/vCPU-s idle (min instances). Memory **$0.0000025**/GiB-s active and idle. Requests **$0.40/million** | VERIFIED | [S1] |
| Instance-based price (Tier 1) | CPU **$0.000018**/vCPU-s, memory **$0.000002**/GiB-s (billed for the whole instance lifetime) | VERIFIED | [S1] |
| Billing granularity | Rounded up to the nearest 100 ms | VERIFIED | [S1] |
| Egress (Premium Tier) | Cloud Run page: "free tier of 1GiB free data transfer within North America per month". The network pricing page (default region view, us-central1) shows "TO Asia excl. Korea, Indonesia": 0–1 GiB free, **$0.12/GiB** 1–1,024 GiB, $0.11/GiB 1–10 TiB. **I could not render the asia-south1-source table separately, so I assume the same rate.** | VERIFIED (us-central1 view) / ASSUMPTION for asia-south1 | [S1], [S3] |
| Billing account | "A Google Cloud billing account is required to access the Google Cloud Free Tier." Free Trial: $300 credit for 90 days, requires a credit card or other payment method. | VERIFIED | [S2] |

**Dollar value of the free tier (ESTIMATE):** 180,000 × $0.000024 + 360,000 × $0.0000025 + 2 × $0.40 ≈ **$6.02/month** of request-based usage.

### 1.2 Limits and streaming

| Item | Value | Label | Source |
|---|---|---|---|
| Request timeout | Default 5 min, **max 60 min**. When the timeout is hit, the client gets a 504, and the container may keep working. | VERIFIED | [S4] |
| HTTP/1 request/response size | 32 MiB, **except chunked/streamed responses**, which are exempt | VERIFIED | [S5] |
| Concurrency | Up to 1,000 concurrent requests per instance (services) | VERIFIED | [S5] |
| Response streaming / SSE | Supported with no configuration. The server must respond with `Transfer-Encoding: chunked`. HTTP/2 is downgraded to HTTP/1 at the container unless `--use-http2`. | REPORTED (search summary of the official "Invoke with HTTPS" doc, page not opened) | [S6] |
| WebSockets | "supported on Cloud Run with no additional configuration required". They are subject to the request timeout (max 60 min). An open connection keeps the instance "active, so CPU is allocated" and billed. Session affinity is best effort only. | VERIFIED | [S7] |
| <1 vCPU instances | Allowed (0.08–1 vCPU), but **require concurrency = 1**, request-based billing and the gen1 environment. This rules them out for a streaming server that holds many requests. | VERIFIED | [S8] |
| Startup CPU boost | Adds CPU during startup and for 10 s after. It is billed. | VERIFIED | [S8] |
| Max instances | Default 100 per revision. Docs suggest "a maximum instances value of 3 to protect your budget". | VERIFIED | [S9] |
| **Spend caps** | Cloud Billing spend-cap budgets can **pause Cloud Run** in a project once gross estimated cost passes 100% of the budget. Existing services return 5xx until the cap is lifted. The calculation uses gross costs and does **not include savings and credits**, so it may trigger before free-tier offsets; set it with that in mind. Enforcement "isn't instant". Search results cite Oct 12–13 2026 release notes calling Cloud Run spend caps GA. | VERIFIED (spend-cap page); REPORTED (GA status) | [S10], [S11] |
| Alerts-only budgets | "doesn't automatically cap… usage or spending" | VERIFIED | [S11] |

### 1.3 Cold starts and min-instances

- Cold start: Google publishes no benchmark for Next.js. A 2026 blog estimates 0.5–2 s for a typical Node app (REPORTED, no methodology) [S12]. Measure it on the real image. Use `output: "standalone"`, a slim base image and startup CPU boost.
- **Cost of `min-instances=1`** (request-based billing, idle rate, 1 vCPU + 0.5 GiB, 30-day month = 2,592,000 s). This is an ESTIMATE from the [S1] prices:
  `1 × 2,592,000 × $0.0000025 + 0.5 × 2,592,000 × $0.0000025 = $6.48 + $3.24 = ` **≈ $9.72/month** at most, if fully idle. Time spent serving is billed at the active rate instead. Whether the free tier's spending-based discount offsets idle charges is not stated (unverified).
- Min instances are "a best-effort target" and "do incur billing costs" (VERIFIED) [S13].
- Recommendation: use min=0 by default and switch to min=1 only for demos or interviews. The tap-to-talk flow hides part of a cold start because the user spends 2–15 s recording, so the client can send a warm-up ping when the mic opens (ASSUMPTION).

### 1.4 Deploying Next.js (standalone) in Docker

- Google's quickstart deploys Next.js with `gcloud run deploy --source .` (Cloud Build builds the image). It needs billing enabled and Node 20+, and it scaffolds with `create-next-app@16` (REPORTED via search summary) [S14].
- Next.js self-hosting guide (VERIFIED) [S15]:
  - Streaming works when self-hosted, but every proxy or load balancer in the path must not buffer. Set `X-Accel-Buffering: no` when behind nginx.
  - With multiple instances, set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` and `deploymentId`. The default ISR/data cache is per instance.
  - `NEXT_PUBLIC_*` variables are inlined at build time. Server variables can be read at runtime, so one image can serve several environments.
- Current versions: `next` 16.4.0 (2026-10-06), `@supabase/ssr` 0.12.7 (VERIFIED via npm registry) [S16].

### 1.5 Artifact Registry and Cloud Build

| Item | Value | Label | Source |
|---|---|---|---|
| Artifact Registry free storage | 0.5 GB per month per billing account. After that, $0.000136986/GiB-hour (≈ $0.10/GiB-month, ESTIMATE). Same-location transfer is free. | VERIFIED | [S2], [S17] |
| Cloud Build free | 2,500 build-minutes/month on `e2-standard-2` | VERIFIED | [S2] |

Keep at most 2–3 images with an Artifact Registry cleanup policy. A Next.js standalone image is typically 150–300 MB (ESTIMATE), so a few images fit in 0.5 GB. Building in GitHub Actions and pushing to Artifact Registry avoids Cloud Build entirely.

---

## 2. Cloudflare Workers and OpenNext

### 2.1 Workers limits and pricing

| Item | Workers Free | Workers Paid ($5/mo minimum) | Label | Source |
|---|---|---|---|---|
| Requests | 100,000/day | 10M/month included, then $0.30/M | VERIFIED | [S18], [S19] |
| CPU time per HTTP request | **10 ms** | Default 30 s, configurable to 5 min. 30M CPU-ms/month included, then $0.02/M CPU-ms | VERIFIED | [S18], [S19] |
| What counts as CPU | Waiting on `fetch()`, KV or DB "does **not** count toward CPU time". Average Worker ≈ 2.2 ms/request. | | VERIFIED | [S18] |
| Wall-clock duration (HTTP) | "No hard limit" | Same | VERIFIED | [S18] |
| Memory | 128 MB per isolate | Same | VERIFIED | [S18] |
| Subrequests | 50/request | 10,000/request | VERIFIED | [S18] |
| Simultaneous outgoing connections | 6 per request | 6 | VERIFIED | [S18] |
| Startup time | 1 s | 1 s | VERIFIED | [S18] |
| Static asset requests | Free and unlimited | Same | VERIFIED | [S19] |
| Egress | — | "There are no additional charges for data transfer (egress) or throughput (bandwidth)" (stated for Paid) | VERIFIED | [S19] |
| **Worker size** | **Conflict.** Cloudflare's limits page: "64 MiB" uncompressed for both plans, and "There is no compressed size limit." OpenNext's docs: "3 MiB on the Workers Free plan, and 10 MiB on the Workers Paid plan" (compressed). The Cloudflare page is authoritative and more recent. The OpenNext text may be stale. Check with `wrangler deploy --dry-run`. | | VERIFIED (both statements read); conflict noted | [S18], [S20] |

**Commercial use on Free:** none of the Cloudflare terms pages I read restrict it. The Developer Platform service-specific terms say Cloudflare "may temporarily limit your storage and/or the number of requests". I did not read the Self-Serve Subscription Agreement (partially VERIFIED) [S21], [S22].

### 2.2 OpenNext Cloudflare adapter (status as of Oct 2026)

| Item | Finding | Label | Source |
|---|---|---|---|
| Package / version | `@opennextjs/cloudflare` **1.20.11** (published 2026-10-13), MIT. peerDependency `next: >=15.5.27 <16 \|\| >=16.3.8`, `wrangler ^4.148.0` | VERIFIED (npm) | [S16] |
| Supported Next versions (docs) | "All minor and patch versions of Next.js 16 and the latest minors of Next.js 14 and 15". The docs also say Next 14 support was to be dropped in Q1 2026. The npm peer range shows only 15.5.27+ and 16.3.8+ now. | VERIFIED | [S20], [S16] |
| Supported features | App Router, Route Handlers, SSR, SSG, ISR, Middleware, `after`, `'use cache'`, image optimisation, PPR, Turbopack | VERIFIED | [S20] |
| Not supported | **Node Middleware (15.2+)** "not yet supported". **Edge runtime** "not supported yet" (remove `export const runtime = "edge"`). | VERIFIED | [S20], [S23] |
| Requirements | `nodejs_compat` flag, `compatibility_date` ≥ 2024-09-23, Wrangler ≥ 3.99 (docs; the current peer is Wrangler 4.148+) | VERIFIED | [S23] |
| Streaming | Not explicitly listed on the OpenNext page. Workers support streaming responses and have no wall-clock limit. | VERIFIED (absence); see [S18] |
| Known issues page | Lists only a caching Durable Objects local-dev warning | VERIFIED | [S24] |
| **Cloudflare's own Next.js guide** | Now recommends **vinext** (Vite-based reimplementation of the Next.js API surface). The guide says "vinext is in beta" (npm `vinext` 1.1.0). OpenNext is positioned for apps that "cannot yet migrate to vinext". This suggests Cloudflare's investment is shifting and adds strategic risk. | VERIFIED | [S25], [S16] |
| Free plan in practice | Next.js SSR plus Supabase auth checks are likely to exceed 10 ms CPU on some requests, which gives Error 1102 "Worker exceeded resource limits". A dev.to post (Aug 2026) reports "Script startup exceeded CPU time limit" with OpenNext. | ESTIMATE / REPORTED | [S26] |

**Verdict:** Workers Free is not viable for a Next.js SSR app with auth. Workers Paid ($5) is viable and very cheap for our I/O-bound workload, but it adds adapter and runtime-compatibility risk.

---

## 3. Vercel Hobby and other hosts

| Host | Commercial use on free? | Key free limits | Label | Source |
|---|---|---|---|---|
| **Vercel Hobby** | **No.** "Hobby teams are restricted to non-commercial personal use only." Commercial use includes any payment request, advertising a product or service, or ads. Donations are OK. | 100 GB Fast Data Transfer, 1M function invocations, 4 CPU-hrs Active CPU, 360 GB-hrs memory, 300 s max function duration, 1-hour runtime logs. Exceeding a limit means waiting 30 days. | VERIFIED | [S27], [S28] |
| **Render Free** | Not addressed directly. The docs say **"Do not use them for production applications."** | Spins down after **15 min** idle, about 1 min spin-up, 750 instance-hours/month per workspace, no persistent disk. Free Postgres **expires after 30 days**. | VERIFIED | [S29] |
| **Railway** | Not stated on the plans page (unverified) | Free: $1 credit/month (0.5 GB RAM, 1 vCPU per service). Trial: one-time $5. Hobby: $5/mo including $5 usage. RAM $10/GB-mo, CPU $20/vCPU-mo, egress $0.05/GB | VERIFIED (limits); unverified (commercial) | [S30] |
| **Fly.io** | n/a | "New organizations don't have a free tier or a monthly free usage allowance." Trial is 2 machine-hours or 7 days. shared-cpu-1x 256 MB ≈ $2.19/mo (iad). Egress to India is in the **$0.12/GB** group. Mumbai (`bom`) is not listed on the pricing page (unverified). | VERIFIED | [S31] |
| **Netlify Free** | Not stated on the pricing page (unverified) | Credit-based: 300 credits (production deploy = 15 credits, bandwidth 20 credits/GB, compute 10 credits/GB-hr, 2 credits/10k requests). That is roughly 15 GB of bandwidth if spent on nothing else. | VERIFIED (limits) | [S32] |

---

## 4. Supabase

### 4.1 Free vs Pro

| Item | Free | Pro ($25/mo) | Label | Source |
|---|---|---|---|---|
| Auth MAU | 50,000 | 100,000 incl., then $0.00325/MAU | VERIFIED | [S33] |
| Database | 500 MB (shared CPU, 500 MB RAM) | 8 GB disk/project, then $0.125/GB. $10/mo compute credits (covers one Micro) | VERIFIED | [S33] |
| File storage | 1 GB, max upload 50 MB | 100 GB, then $0.0213/GB | VERIFIED | [S33] |
| Egress | 5 GB uncached + 5 GB cached (separate quotas) | 250 GB + 250 GB cached. Overage $0.09/GB uncached, $0.03/GB cached | VERIFIED | [S33], [S34] |
| What counts as egress | DB responses to clients, Auth, Storage downloads, Edge Function responses, Realtime pushes, shared pooler. **This includes our backend's reads from Postgres.** | | VERIFIED | [S34] |
| Edge Functions | 500k invocations | 2M, then $2/M | VERIFIED | [S33] |
| Edge Function limits | 256 MB memory, **2 s CPU**, wall clock 150 s (Free) / 400 s (paid), idle timeout 150 s, 20 MB bundle (CLI) | | VERIFIED | [S35] |
| Realtime | 200 concurrent connections, 2M messages/month, 100 msg/s, 256 KB broadcast payload | 500 conns (+$10/1000), 5M msgs (+$2.50/M), 500 msg/s | VERIFIED | [S33], [S36] |
| **Pausing** | "Free projects are paused after 1 week of inactivity" | Not paused | VERIFIED | [S33] |
| **Backups** | **None.** Docs: free projects should "regularly export their data using the Supabase CLI `db dump`" and keep off-site backups | Daily backups kept 7 days. PITR $100/mo per 7 days | VERIFIED | [S33], [S37] |
| Active projects | 2 | Unlimited | VERIFIED | [S33] |
| Log retention | 1 day | 7 days | VERIFIED | [S33] |
| Exceeding Free quotas | Notification, then a one-time grace period, then possible restrictions: read-only DB, paused projects, HTTP 402 on API | Spend cap on by default | VERIFIED | [S38], [S33] |
| Commercial use on Free | Not addressed on the pages read (unverified) | | | |

### 4.2 Region, auth and RLS

- **Mumbai `ap-south-1` is available** as a "specific region" (VERIFIED) [S39]. Choose it: users, Cloud Run asia-south1 and the DB are then co-located, and data stays in India at rest (helpful for the DPDP narrative, though not legally required today).
- **Google OAuth** (VERIFIED) [S40]:
  - In Google Cloud, create a Web client. Authorised JS origins are your site origin. The redirect URI is the Supabase callback (`https://<project>.supabase.co/auth/v1/callback`, or your custom auth domain).
  - Add the `openid` scope. Email and profile are default.
  - Configure Branding and Verification on the Google Auth Platform. "Brand verification is not automatic and may take a few business days." Without it, the consent screen shows the Supabase project ID. Sensitive scopes trigger a longer review.
  - Next.js App Router: use `@supabase/ssr` and PKCE. `signInWithOAuth` stores the PKCE verifier in a cookie. Add an `app/auth/callback/route.ts` that calls `exchangeCodeForSession(code)`. Accept only relative `next` redirects.
  - One Tap is possible (nonce + `signInWithIdToken`, `use_fedcm_for_prompt: true`).
  - A Supabase custom domain (e.g. `auth.example.com`) is recommended to reduce phishing confusion. It is a paid add-on (price not verified here).
- **Row Level Security:** enable RLS on every table in exposed schemas, with policies keyed on `auth.uid()`. The backend uses the service-role key only server-side (Cloud Run secret), never in the browser. These are standard Supabase practices, not re-read this session (REPORTED).

### 4.3 When to move to Pro (ESTIMATE)

Move to Pro at the **first of** these triggers:
- (a) **Commercial launch.** No backups and auto-pause are unacceptable for paying users.
- (b) DB passes about 400 MB. Transcripts grow about 160 MB/month at 1,000 MAU (see §9).
- (c) Opt-in audio storage passes 1 GB.
- (d) Egress approaches 5 GB.

At our assumptions, that is roughly 300–1,000 MAU.

---

## 5. Free tiers: observability, CI and rate limiting

| Service | Free allowance | Overage / next tier | Label | Source |
|---|---|---|---|---|
| **Sentry Developer** | 5k errors/mo, 5M spans, 50 replays, 1 GB attachments, 1 cron + 1 uptime monitor, 30-day lookback, **1 user** | Team from $26/mo (annual) | VERIFIED | [S41] |
| **PostHog** (free, no card) | 1M analytics events, **5K session recordings**, 1M feature-flag requests, 100K error exceptions, 1,500 survey responses, 1 project, 1-year retention. "Usage stops at the free tier limits". | Events: $0.00005 each (1–2M), $0.0000343 (2–15M). Billing limits per product | VERIFIED | [S42], [S43] |
| **GitHub Actions** (Free personal, private repos) | **2,000 min/month**, 500 MB artifact storage, 10 GB cache/repo. Linux 2-core $0.006/min beyond. Public repos and self-hosted runners free. | | VERIFIED | [S44] |
| **Upstash Redis** Free | 500K commands/mo, 250 MB, 10 GB bandwidth. The page contradicts itself on DB count (1 vs 10). | PAYG $0.20/100K commands. Mumbai region not listed (unverified) | VERIFIED | [S45] |

**Rate limiting: Upstash vs Postgres (ESTIMATE).**
- At 10,000 MAU there are about 960k turns/month (§9). At about 3 Redis commands per check, that is about 2.9M commands, roughly $5/mo on Upstash and over the free 500K.
- A **Postgres-based limiter** costs nothing extra and keeps one fewer processor in the privacy notice. It can be a `usage_counters` table with a `SECURITY DEFINER` function doing an atomic `INSERT … ON CONFLICT DO UPDATE` per user per day/minute. This is enough at our scale, because each turn already writes to Postgres.
- Add a coarse **per-instance in-memory token bucket** for burst protection.
- Use Upstash only if Postgres latency becomes a problem.

---

## 6. Browser audio on target devices

### 6.1 Capture: MediaRecorder, getUserMedia, constraints

| Topic | Chrome Android | iOS Safari / iOS PWA | Label | Source |
|---|---|---|---|---|
| MediaRecorder | Since Chrome 47 | Since iOS 14 | VERIFIED (MDN BCD 8.1.5) | [S46] |
| Recording formats | WebM/Opus 48 kHz (and PCM). MP4/AAC also from Chrome 126+ | iOS 14.3+: **MP4 (fragmented)/AAC**. **iOS 18.4+: WebM/Opus also** ("now supports creating WebM files using the Opus audio codec"). Ogg/Opus support also arrived in 18.4. | VERIFIED (WebKit 18.4) / REPORTED (addpipe table) | [S47], [S48] |
| Default mimeType | `audio/webm;codecs=opus` (REPORTED) | `audio/mp4` (REPORTED). Always choose explicitly with `MediaRecorder.isTypeSupported()` (iOS 14+) | REPORTED / VERIFIED (API support) | [S48], [S46] |
| STT compatibility | OpenAI transcription accepts mp3, mp4, mpeg, mpga, m4a, wav, **webm**, up to 25 MB. Both browsers' native outputs can be uploaded without transcoding. | | VERIFIED | [S49] |
| `echoCancellation` constraint | Supported (Chrome Android 59+) | Supported (iOS 11+) | VERIFIED (BCD) | [S46] |
| `noiseSuppression`, `autoGainControl` | Supported (67+) | **Not supported** per BCD (`version_added: false`) | VERIFIED (BCD) | [S46] |
| Permission persistence in installed PWA | Chrome persists the per-origin grant | WebKit bug 215884: in home-screen web apps, the camera/mic prompt can **reappear on route changes**. A related bug says the stream stops on navigation in standalone mode. Users can grant persistent access in Safari per-site settings. I could not confirm whether this is fixed on iOS 26/27. **Must test on device.** | REPORTED | [S50] |

**Practical implications (ESTIMATE / design guidance):**
- Keep the recorder inside a single client-side route so that recording on iOS PWAs does not cross a navigation.
- Request the mic once per session and reuse the `MediaStream`. Stop tracks when the session ends to clear the recording indicator.
- Pick the format in this order: `audio/webm;codecs=opus` → `audio/mp4` → browser default. Set `audioBitsPerSecond ≈ 32000` for speech.

### 6.2 Playback: autoplay, unlocking, iOS audio session

| Topic | Finding | Label | Source |
|---|---|---|---|
| General autoplay rule | Audible playback is blocked unless the user has interacted with the site, the site is allow-listed, or the media is muted. `play()` rejects with `NotAllowedError`. | VERIFIED | [S51] |
| Chrome | Since Chrome 71, the policy applies to Web Audio. An `AudioContext` created before a gesture starts `suspended`, and you must call `resume()` after a gesture. **Mobile: adding the site to the home screen allows autoplay with sound.** | VERIFIED | [S52] |
| iOS Safari | BCD note: "New audio contexts are suspended until the `resume()` method is called via user action". | VERIFIED | [S46] |
| `navigator.getAutoplayPolicy()` | **Not supported** on Chrome Android or iOS Safari | VERIFIED (BCD) | [S46] |
| iOS silent switch | `navigator.audioSession` exists on iOS 16.4+ (not Chrome). WebKit bug threads report the default session type `ambient` **mutes Web Audio when the ring/silent switch is on**, while `<audio>` keeps playing. Setting `navigator.audioSession.type = "playback"` (or `"play-and-record"`) fixes this. | VERIFIED (API exists) / REPORTED (behaviour) | [S46], [S53], [S54] |
| iOS output route while mic is open | Not verified this session. Commonly reported: with an active mic in "play-and-record", output can be quieter or routed differently. **Test on device.** | UNVERIFIED | — |

**Unlock pattern (design, ESTIMATE):**
1. On the user's tap-to-talk `pointerdown`, create or `resume()` a single shared `AudioContext`.
2. Play a 1-sample silent buffer to unlock it.
3. Prime one reusable `<audio>` element (`play()` of a short silent clip, then `pause()`).
4. On iOS, set `navigator.audioSession.type = "play-and-record"` while recording and `"playback"` before tutor audio, when available.

Tutor audio arrives seconds after the gesture, so it must play through these already-unlocked objects. Do not create new ones later.

### 6.3 Streaming TTS playback: approach comparison

| Approach | Chrome Android | iOS Safari | Formats | Latency | Complexity | Verdict |
|---|---|---|---|---|---|---|
| **A. Per-sentence complete clips → `decodeAudioData` → schedule `AudioBufferSourceNode`s back-to-back** | Yes (`decodeAudioData` since 18) | Yes (since iOS 6; AudioContext unprefixed 14.5) | **MP3 everywhere**. Ogg/Opus on iOS 18.4+ (ESTIMATE that decodeAudioData accepts it; verify with `canPlayType`) | First audio after sentence 1 is synthesised. Gapless scheduling | Low–medium | **Recommended** |
| B. One reusable `<audio>` element, set `src` = Blob URL per sentence, play on `ended` | Yes | Yes, if the element was unlocked by a gesture (REPORTED behaviour, test it) | MP3, AAC. Opus/Ogg on iOS 18.4+ | Small gaps between sentences (~50–150 ms, ESTIMATE) | Lowest | Fallback, and used for "Slow" replay |
| C. MediaSource Extensions (append MP3/fMP4 bytes as they stream) | Yes (MSE since Chrome 31) | **iPhone: classic MSE not exposed** ("Exposed in Mobile Safari on iPad but not on iPhone"). **ManagedMediaSource** on iOS 17.1+ only. It requires remote playback disabled or an AirPlay alternative source. | MP3/AAC in MSE (codec specifics not verified for MMS) | Lowest for long utterances | High (two code paths) | Not for v1 |
| D. Raw PCM over stream → AudioWorklet | Yes (AudioWorklet 66+) | Yes (14.5+) | PCM 24 kHz 16-bit (OpenAI `pcm`) or ElevenLabs `pcm_*` | Lowest | Medium | Avoid on 4G: **~384 kbps, about 6× MP3 64 kbps** |

Sources: BCD [S46] (MediaSource, ManagedMediaSource, decodeAudioData, AudioWorklet), WebKit 17.1 (MMS requirements) [S55], WebKit 18.4 (Ogg/WebM Opus) [S47]. The TTS formats themselves are VERIFIED:
- OpenAI `response_format`: mp3 (default), opus ("for internet streaming… low latency"), aac, flac, wav, pcm (24 kHz 16-bit). For fastest response it recommends wav/pcm [S56].
- ElevenLabs `output_format` includes `mp3_22050_32`, `mp3_24000_48`, `mp3_44100_32`/`64`/…, `opus_48000_32`/`64`/…, and `pcm_8000`…`pcm_48000`. The default is `mp3_44100_128` [S57].

**Transport:** POST the recorded clip with `fetch()` and read the streamed response body. `Response.body` / `ReadableStream` work on Chrome Android 43+ and iOS 10.3+ (VERIFIED, BCD) [S46]. Frame the response as length-prefixed binary chunks or NDJSON events (text deltas, then one audio chunk per sentence). `EventSource` (SSE) is GET-only, so it cannot carry the upload. WebSockets are an alternative but add per-connection state on Cloud Run.

### 6.4 "Slow" replay: `playbackRate` + `preservesPitch`

- `HTMLMediaElement.preservesPitch` defaults to `true`. It is supported in **Chrome Android 86+** and **iOS Safari 17.2+** (unprefixed). `webkitPreservesPitch` was available on older iOS (VERIFIED, BCD) [S46], [S58].
- **Web Audio's `AudioBufferSourceNode.playbackRate` does not preserve pitch** (ESTIMATE; standard behaviour), so implement "Slow" replay with an `<audio>` element.
- Implementation:
  1. Keep the sentence MP3 blobs.
  2. Concatenate them into one Blob. Concatenating MP3 frames usually plays fine (ESTIMATE; test it).
  3. Play with `playbackRate = 0.75` and `preservesPitch = true`.
- Alternative: re-synthesise slowly with the TTS provider's speed setting. That costs extra TTS money and is not verified here.

### 6.5 Client-side VAD

| Option | License | Payload | Mobile notes | Label | Source |
|---|---|---|---|---|---|
| **@ricky0123/vad-web** 0.0.31 (2026-09-12) | npm metadata: **ISC**. GitHub's license detector returns "NOASSERTION", so check the LICENSE file. Silero VAD model: **MIT** | `bundle.min.js` 69 KB. Model `silero_vad_legacy.onnx` 1.81 MB / `silero_vad_v5.onnx` 2.33 MB. Dependency `onnxruntime-web` (MIT): `ort-wasm-simd-threaded.wasm` **11.2 MB raw, ~2.9 MB gzip**. **About 5 MB+ compressed on first load** | Uses AudioWorklet (iOS 14.5+). An HN anecdote reports Silero + ASR in-browser hit **out-of-memory crashes on iOS Safari**. Not specific to vad-web. | VERIFIED (sizes/licence via npm/unpkg/GitHub API) / REPORTED (iOS OOM) | [S59], [S60], [S61] |
| **Energy/RMS gate** (AnalyserNode or AudioWorklet RMS + hangover) | Own code | ~1 KB | Negligible CPU. Less robust to noise such as fans and traffic | ESTIMATE | — |

**Recommendation:**
1. **v1:** energy-based. Reject a clip if fewer than about 300 ms of frames exceed an adaptive threshold, calibrated from the first 200 ms of noise floor.
2. Add a server guard: an empty or very short STT transcript returns "I didn't catch that" without calling the LLM or TTS.
3. Consider lazily loading Silero, Android-only, later.

---

## 7. India DPDP Act 2023 and DPDP Rules 2025

### 7.1 Status and dates

| Item | Finding | Label | Source |
|---|---|---|---|
| Rules notified | **G.S.R. 846(E), "New Delhi, the 13th November, 2025"** | VERIFIED (Gazette PDF) | [S62] |
| Phase 1 | "Rules 1, 2 and 17 to 21 shall come into force on the date of their publication". This covers the Data Protection Board. | VERIFIED | [S62] |
| Phase 2 | "Rule 4 shall come into force one year after" publication (Consent Managers). **≈ 13 Nov 2026** | VERIFIED | [S62] |
| Phase 3 | "Rules 3, 5 to 16, 22 and 23 shall come into force eighteen months after" publication. This covers notice, security, breach, retention, contact info, **children**, rights, cross-border, SDF duties. **≈ 13 May 2027** | VERIFIED | [S62] |
| Date conflict | Shardul Amarchand Mangaldas lists 14 Nov 2025 / 14 Nov 2026 / 14 May 2027. Most others say the 13th. Plan for the earlier date. | REPORTED | [S63] |
| Act commencement | A separate commencement notification (G.S.R. 843(E)) brings Act sections in line with the same phases. The repeal of IT Act **s.43A** (SPDI regime) takes effect with Phase 3 (May 2027). | REPORTED | [S63], [S64] |
| Proposal to shorten to 12 months | Business Standard (22 Jan 2026) reported MeitY was considering it. **As of a 12 Oct 2026 review, no amending instrument was found.** | REPORTED | [S65] |
| Recent amendment | "DPDP (Removal of Difficulties) Order, 2026", S.O. 5458(E), dated 5 Oct 2026. It makes textual fixes to s.9(1) ("child or **of** a person with disability") and s.10(2)(c)(ii) ("data audit"). No change to dates. | REPORTED (Foxmandal) | [S66] |
| Until May 2027 | The IT Act s.43A and **SPDI Rules 2011** still apply to "body corporates". | REPORTED | [S64] |

### 7.2 Key obligations for a small Data Fiduciary like us

We decide the purpose and means, so we are a **Data Fiduciary** (Act s.2(i)) (VERIFIED) [S67]. OpenAI, the TTS provider, Supabase, Google Cloud, Sentry and PostHog are **Data Processors** and need a **valid contract** (s.8(2)) that includes security safeguards (Rule 6(1)(f)) (VERIFIED) [S67], [S62].

| Obligation | What the law says | Label | Source |
|---|---|---|---|
| **Consent** | "free, specific, informed, unconditional and unambiguous with a clear affirmative action… limited to such personal data as is necessary" (s.6(1)). Withdrawal must be as easy as giving consent (s.6(4)). | VERIFIED | [S67] |
| **Notice** (s.5 + Rule 3) | Must be understandable on its own. Use "clear and plain language". Include an **itemised description of personal data** and the specified purposes and services. Give a link and means to **withdraw consent, exercise rights, and complain to the Board**. | VERIFIED | [S67], [S62] |
| **Language** | The consent request must give "the option to access such request in English or any language specified in the Eighth Schedule" (22 scheduled languages) (s.6(3)). | VERIFIED | [S67] |
| **Purpose limitation and erasure** | Erase when consent is withdrawn or the purpose is no longer served, and make processors erase (s.8(7)). The erasure right is in s.12(3). | VERIFIED | [S67] |
| **⚠ Minimum retention, Rule 8(3)** | Retain "such personal data, associated traffic data and other logs of the processing for a **minimum period of one year** from the date of such processing, for the purposes as specified in the Seventh Schedule" (state and security requests), then erase. The illustration says this applies "**even if X deletes her account**". Rule 6(1)(e) adds 1-year log retention for security. Commentators debate how broad this is (NALSAR calls it retention-by-default). | VERIFIED (text) / REPORTED (interpretation) | [S62], [S68] |
| 3-year inactivity erasure (Third Schedule) | Applies only to e-commerce (≥2 crore users), gaming (≥50 lakh) and social media (≥2 crore). **Not us.** | VERIFIED | [S62] |
| **Security** (Rule 6) | Encryption, obfuscation or masking. Access control. Access logging and monitoring. Backups. Logs kept 1 year. Processor contracts. | VERIFIED | [S62] |
| **Breach notification** (Rule 7) | Tell **each affected user** "without delay" what happened, likely consequences, mitigations, steps they can take and a contact. Tell the **Board** without delay, then send a detailed report **within 72 hours**. | VERIFIED | [S62] |
| CERT-In (existing law, 2022 Directions) | Report specified cyber incidents **within 6 hours**. Keep ICT logs **180 days within India**. Applies to service providers, intermediaries, data centres and body corporates (applicability to a sole developer needs advice). | REPORTED | [S69] |
| **Contact and grievance** | Publish a contact for processing questions (Rule 9, s.8(9)). Run an effective grievance mechanism (s.8(10)). **Respond within ≤ 90 days** (Rule 14(3)). Publish how to make rights requests and what identifiers are needed (Rule 14(1)). Users may nominate another person (Rule 14(4)). | VERIFIED | [S67], [S62] |
| **Rights** | Summary of data and processing, and **identities of all Data Fiduciaries/Processors it was shared with** (s.11). Correction and erasure (s.12). Grievance redressal (s.13). | VERIFIED | [S67] |
| **Significant Data Fiduciary** | Only when the Government **notifies** a fiduciary or class, based on volume and sensitivity, risk, sovereignty and similar factors (s.10). SDFs need a DPO in India, an independent data auditor, a DPIA and annual audit (Rule 13), and possible localisation (Rule 13(4)). **Very unlikely for us.** | VERIFIED | [S67], [S62] |
| **Cross-border transfer** | **Negative-list model.** Government "may, by notification, restrict" transfers to notified countries (s.16(1)). Rule 15 lets it set requirements on making data available to foreign states. Stricter sectoral laws still apply (s.16(2)). **I found no notified restricted country** in the sources reviewed (REPORTED absence). | VERIFIED (text) | [S67], [S62] |
| Startup exemption | The Government *may* notify startups as exempt from s.5 (notice), s.8(3), s.8(7), s.10 and s.11 (s.17(3)). The "startup" definition requires an Indian company, LLP or partnership recognised as a startup. **No such notification found.** Does not apply to an individual developer. | VERIFIED (text) / REPORTED (no notification) | [S67] |
| **Penalties** (Schedule) | Up to ₹250 crore for security safeguards failure. ₹200 crore for breach-notification failure. **₹200 crore for children's obligations.** ₹50 crore for other breaches. | VERIFIED | [S67] |

### 7.3 Children (under 18) and an 18+-only product

- **Definition:** "child" means "an individual who has not completed the age of eighteen years" (s.2(f)) (VERIFIED) [S67].
- **Duties if we process a child's data:**
  - Get **verifiable parental consent before processing any personal data of a child** (s.9(1)).
  - No processing "likely to cause any detrimental effect on the well-being of a child" (s.9(2)).
  - **No tracking or behavioural monitoring of children or targeted advertising** directed at them (s.9(3)).
  - Rule 10 requires due diligence that the parent is an identifiable adult. This uses reliable identity and age details already held, or details or a virtual token (e.g. DigiLocker) (VERIFIED) [S67], [S62].
- **Exemption for checking age:** Fourth Schedule Part B item 6 exempts processing "for confirmation by the Data Fiduciary that the Data Principal is not a child", limited to what is necessary. So **collecting date of birth or age to gate sign-up is allowed** (VERIFIED) [S62].
- **What an adult-only service must do:** **The Act and Rules prescribe no specific age-verification method for services that exclude children.** Legal commentary is split:
  - some say a self-declared DOB is enough;
  - others say a "simple declaration" will not satisfy Rule 10 where children are processed;
  - others call it unresolved (REPORTED) [S70], [S71].
- **Practical reading (ESTIMATE, not legal advice):** if we reliably keep children out, we never process a child's data and avoid s.9. The risk is that a minor lies.

  Our analytics (PostHog), session replay and adaptive tutoring are arguably "tracking or behavioural monitoring". These are prohibited for children, so if a minor gets in, we breach s.9(3) as well as s.9(1).

  **Recommended:**
  1. Use a neutral DOB age gate before account creation. Do not pre-fill it or hint at the cut-off.
  2. Block under-18 entries and do not store the DOB beyond the check, or store only an "18+ confirmed" flag and timestamp.
  3. Make the Terms state 18+.
  4. Add a "report an underage user" route and a process to delete promptly.
  5. Do not market to minors.
  6. Optionally use Google account age signals. Not verified: the Google birthday scope is a sensitive scope and likely triggers verification.
  7. Get a lawyer's view before May 2027.

### 7.4 Voice data

- **DPDP has no "sensitive personal data" category.** Voice recordings and transcripts are ordinary personal data under the Act (VERIFIED by absence in Act text) [S67].
- **SPDI Rules 2011 (in force until about May 2027):** "Biometrics" includes "'voice patterns'… for authentication purposes" (rule 2(1)(b)). Biometric information is sensitive personal data. We do not use voice for authentication, so we arguably fall outside this, but treat it conservatively: explicit opt-in, written policy, and reasonable security practices (VERIFIED text) [S72].
- Microsoft's Azure Speech guidance warns that voice "may be considered personal data and/or sensitive data" and that **biometric** processing (e.g. diarization/voice signatures) brings notice, consent and deletion duties (VERIFIED) [S73].
- **Design:**
  - Do not use speaker identification or voice embeddings.
  - Keep audio retention opt-in, with a separate checkbox and purpose.
  - Delete opt-in audio at 30 days with a scheduled job.
  - Process clips in memory and never write learner audio to disk or logs by default.
  - Rule 8(3) may still require keeping *processing logs* (not the audio) for 1 year.

---

## 8. Processor data policies (privacy-notice essentials)

| Processor | What matters for the notice | Label | Source |
|---|---|---|---|
| **OpenAI API** | API data is "not used to train or improve OpenAI models" unless you opt in. Abuse-monitoring logs are kept "up to 30 days" by default. `/v1/audio/transcriptions`: **no** abuse-monitoring or application-state retention. `/v1/audio/speech` and Realtime: 30-day abuse-monitoring logs. Responses API: 30-day app state unless `store=false`/ZDR. Chat Completions audio outputs: 1 hour. **ZDR requires prior OpenAI approval.** **India data residency (`in.api.openai.com`) = regional storage only, no regional processing**, and needs ZDR/MAM approval. So processing happens outside India: disclose a cross-border transfer. | VERIFIED | [S74], [S49] |
| **ElevenLabs** | Acts as "service provider"/"data processor" for business customers, with the contract governing. The privacy policy says inputs/outputs may be used to "research, build, train and improve our AI models" with an **opt-out** in account settings. Whether this covers API traffic is unclear, so confirm in the DPA/terms. Data is "transferred to the United States for storage". **Zero Retention Mode (`enable_logging=false`) is enterprise-only.** Otherwise generation history is kept until deleted, and backups keep data ≤30 days after deletion. | VERIFIED | [S75], [S76] |
| **Azure AI Speech** | Real-time STT/TTS: "processed only on the Azure's server memory, and no data is stored at rest". "Microsoft does not retain or store the data" for real-time STT. TTS: "no data is persisted". Biometric (diarization) caveats apply. | VERIFIED | [S73] |
| Supabase, Google Cloud, Sentry, PostHog | Each needs listing as a processor with location. Supabase can be pinned to **Mumbai**. Cloud Run is in asia-south1. Sentry/PostHog hosting regions and DPAs were **not verified in this pass**. | — | — |

---

## 9. Infrastructure cost estimate (excluding AI model costs)

### 9.1 Assumptions (all ESTIMATE/ASSUMPTION unless cited)

| # | Assumption | Value |
|---|---|---|
| A1 | Sessions per MAU per month (given) | 8 × 5 min |
| A2 | Turns per session | 12 |
| A3 | Backend wall-time per turn (upload + STT + LLM + TTS streaming) | ≈ 8 s. Plus page/API requests, giving **≈ 120 s billable instance-time per session** if sessions don't overlap |
| A4 | Tutor speech per session | 50% of 5 min = **150 s** |
| A5 | Cloud Run config | asia-south1 (Tier 1), 1 vCPU / 0.5 GiB, concurrency 40–80, request-based billing, min=0 |
| A6 | Non-audio egress per session (API JSON, HTML; JS cached by PWA/CDN) | 0.3 MB |
| A7 | Transcript + metadata growth in Postgres | ≈ 20 KB/session (incl. indexes) |
| A8 | Opt-in audio retention | 20% of sessions, ~1 MB learner audio/session, rolling 30 days |
| A9 | Supabase egress (history views + backend reads) | ≈ 100 KB/session |
| A10 | PostHog events per session | 30 (or 10 if trimmed) |
| A11 | Requests per session | ≈ 30 |
| A12 | Egress rate | $0.12/GiB after 1 GiB free (§1.1, assumed for asia-south1) |

**Audio bytes per session (formula):** `bytes = bitrate_bps / 8 × 150 s`

| Format | Bitrate | Audio per session | + overhead (A6) | Label |
|---|---|---|---|---|
| MP3 64 kbps (e.g. ElevenLabs `mp3_44100_64`) | 64,000 | **1.20 MB** | 1.5 MB | ESTIMATE |
| Opus 32 kbps (`opus_48000_32`) | 32,000 | **0.60 MB** | 0.9 MB | ESTIMATE |
| PCM 24 kHz 16-bit mono (OpenAI `pcm`) | 384,000 | **7.20 MB** | 7.5 MB | ESTIMATE |

OpenAI does not publish bitrates for its mp3/opus outputs, so these are format-class estimates.

### 9.2 Formulas

- Sessions `S = MAU × 8`
- **Cloud Run billable instance-seconds `T`**:
  - Low traffic (no overlap, upper bound): `T = S × 120 s`.
  - With overlap, assuming traffic spread over 16 active hours/day (`H = 16 × 3600 × 30 = 1,728,000 s`), Poisson: `λ = S×120 / H` and `T ≈ H × (1 − e^(−λ))`.
  - At high load, `T` approaches whole-month instance time (`2,592,000 s` per instance), plus extra instances at peaks.
- **Request-based cost** = `max(0, T − 180,000) × $0.000024 + max(0, 0.5T − 360,000) × $0.0000025 + max(0, 30S − 2M) × $0.40/1M`
- **Instance-based cost** = `max(0, T − 240,000) × $0.000018 + max(0, 0.5T − 450,000) × $0.000002`
- **Egress cost** = `max(0, S × perSessionMB / 1073.74 − 1) × $0.12` (MB → GiB)
- **Postgres growth** = `S × 20 KB` per month. **Storage** = `S × 0.2 × 1 MB` (rolling). **Supabase egress** = `S × 100 KB`.
- **PostHog cost** = `max(0, min(events,2M) − 1M) × $0.00005 + max(0, events − 2M) × $0.0000343`

### 9.3 Results

| Line item | 100 MAU (S = 800) | 1,000 MAU (S = 8,000) | 10,000 MAU (S = 80,000) |
|---|---|---|---|
| Cloud Run instance-time `T` | 96,000 s | 0.74M–0.96M s (λ = 0.56) | ≈ 2.6M s (≈ 1 instance all month + peaks) |
| **Cloud Run compute** | **$0** (within free tier) | **$13.4–$19.0** (request-based) | **$60.6** request-based / **$44.2** instance-based (switch billing mode at this scale) |
| Cloud Run requests | 24k → $0 | 240k → $0 | 2.4M → $0.16 |
| **Egress, MP3 64k** | 1.2 GB → $0.01 | 12 GB → **$1.22** | 120 GB → **$13.29** |
| Egress, Opus 32k | 0.72 GB → $0 | 7.2 GB → $0.69 | 72 GB → $7.93 |
| Egress, PCM (avoid) | 6 GB → $0.55 | 60 GB → $6.59 | 600 GB → $66.94 |
| Postgres growth | 16 MB/mo | 160 MB/mo (500 MB Free full in ~3 months) | 1.6 GB/mo (Pro 8 GB full in ~5 months, then $0.125/GB) |
| Opt-in audio storage | 0.16 GB | 1.6 GB (> 1 GB Free) | 16 GB (Pro incl. 100 GB) |
| Supabase egress | 0.08 GB | 0.8 GB | 8 GB (> 5 GB Free) |
| **Supabase plan** | **Free $0** | **Pro $25** (recommended; Free technically possible only without audio opt-in and with manual backups) | **Pro $25** (+ ~$0–5 disk overage over time) |
| Artifact Registry | $0 (≤ 0.5 GB) | $0 | $0 |
| GitHub Actions | $0 | $0 | $0 |
| Sentry | $0 | $0 | $0–26 (Team if > 5k errors or > 1 user) |
| PostHog (30 events/session) | 24k → $0 | 240k → $0 | 2.4M → **$63.72**. At 10 events/session (800k), $0 |
| PostHog replays | ≤ 5k → $0 | sample ≤ 60% → $0 | sample ≤ 6% → $0 |
| Rate limiting | Postgres → $0 | $0 | $0 (Upstash would be ~$5) |
| **Total (MP3, lean analytics)** | **≈ $0** | **≈ $40–45** with Supabase Pro (≈ $15–20 on Free) | **≈ $82–113** (instance-based CR $44 + egress $13 + Supabase $25–30 + Sentry $0–26 + PostHog $0) |

**Free-tier exhaustion points (ESTIMATE):**
- Cloud Run CPU free tier: `180,000 / (8 × 120) ≈ 190 MAU` without overlap, higher with overlap.
- Cloud Run egress (1 GiB): `≈ 1074 MB / (8 × 1.5 MB) ≈ 90 MAU` (MP3), ~150 MAU (Opus).
- Supabase DB 500 MB: cumulative. At 1,000 MAU, about 3 months. At 300 MAU, about 9 months.
- Supabase storage 1 GB: about 625 MAU at 20% audio opt-in.
- PostHog 1M events: about 4,200 MAU at 30 events/session.

**Cloudflare Workers Paid comparison at 10,000 MAU (ESTIMATE):**
- Requests: 2.4M, below the 10M included.
- CPU: 2.4M × ~20 ms = 48M CPU-ms, which is 18M over × $0.02/M = $0.36.
- Egress: $0.
- **Total ≈ $5.40/mo, versus about $57 for Cloud Run compute and egress.**

Workers bill CPU, not the 8 s per turn spent waiting on AI APIs. This is the main economic argument for Workers at scale.

**Sensitivity:** Cloud Run cost scales linearly with A3. Cutting turn wall-time from 8 s to 5 s cuts compute by about 35%. Opus instead of MP3 halves audio egress but needs the iOS format split (§6.3).

> **Budget flag:** These figures **exclude** STT, LLM and TTS, which another analyst covers and which will likely dominate. With a $50/month total, infrastructure fits easily at about 100 MAU. At about 1,000 MAU, infrastructure alone takes about $15–45 (depending on Supabase tier), leaving little or nothing for AI. Plan monetisation or per-user usage caps before about 300 MAU (ESTIMATE).

---

## 10. Recommendation

### 10.1 Hosting

**Primary: Google Cloud Run, asia-south1 (Mumbai), single Next.js standalone container**

Use request-based billing with min=0 (min=1 only for demos), max-instances=3, concurrency ~40. Set a **Cloud Run spend cap** of about $25 and alert budgets.

- **Pros**
  - Commercial use allowed; the free tier covers about the first 100–190 MAU.
  - A standard Node runtime with no adapter. Every Next.js 16 feature works.
  - Streaming, SSE and WebSockets are supported, with a 60-min timeout.
  - Mumbai region is co-located with Supabase ap-south-1 and close to users.
  - The container is portable: **low lock-in**, and it moves to Fly, Railway or a VPS unchanged.
  - The spend cap (GA Oct 2026) limits bill-shock risk.
- **Cons**
  - Billed on **wall time** while waiting on AI APIs.
  - Needs a billing account and card.
  - Cold starts of about 0.5–2 s (REPORTED).
  - Egress is $0.12/GiB.
  - You own the Dockerfile and GCP IAM setup.
- **Lock-in:** low. Optional GCP-specific pieces are Secret Manager and Cloud Logging.

**Alternative: Cloudflare Workers Paid ($5/mo) + `@opennextjs/cloudflare`**

- **Pros**
  - Cheapest at scale (≈ $5–6/mo at 10k MAU for compute and egress).
  - CPU-time billing suits I/O-bound AI proxying.
  - No egress fees and no cold-start penalty to speak of.
  - Edge PoPs near Indian users.
- **Cons**
  - Free plan's 10 ms CPU is unusable for SSR, so you must pay $5 from day one.
  - Adapter risk: OpenNext is maintained (1.20.x), but Cloudflare now steers new projects to **vinext (beta)**. No Edge runtime, no Node Middleware.
  - 128 MB memory and `nodejs_compat` edge cases.
  - Worker-size documentation conflicts (3/10 MiB vs 64 MiB).
  - Harder local debugging.
- **Lock-in:** moderate (wrangler config, bindings, adapter quirks).

**Migration path (ESTIMATE):** start on Cloud Run. If compute exceeds about $20/mo, move only the voice-turn route (`/api/turn`) to a small Worker or another CPU-billed runtime, and keep the Next.js app on Cloud Run. Do not use Vercel Hobby (non-commercial) or Render Free ("not for production").

### 10.2 Database and auth

- **Supabase in ap-south-1.** Start on Free during development, with a weekly `supabase db dump` GitHub Action. Keep the project active to avoid the 7-day pause.
- **Upgrade to Pro ($25) at public or commercial launch** for backups and no pausing.
- Enable RLS on all tables. Use the service-role key only on the server.
- Use Postgres-based rate limiting, not Upstash.

### 10.3 Audio capture and playback by browser

| Concern | Chrome Android | iOS Safari (tab and installed PWA) |
|---|---|---|
| Mic | `getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1}})` | Same call. Only `echoCancellation` is honoured (BCD). Keep recording within one route (PWA re-prompt bug). Set `navigator.audioSession.type="play-and-record"` while recording (iOS 16.4+). |
| Recorder format | `audio/webm;codecs=opus`, 32 kbps | `isTypeSupported('audio/webm;codecs=opus')` (iOS 18.4+), else `audio/mp4` (AAC). Upload as-is; OpenAI accepts webm/mp4/m4a. |
| VAD | Energy/RMS gate (+ server empty-transcript guard). Optionally lazy Silero later. | Energy/RMS gate only (memory risk with ONNX/WASM). |
| Unlock | On tap: `audioCtx.resume()` + silent buffer, and prime one `<audio>` element. Installed PWA on Android also gets autoplay-with-sound. | On tap: `audioCtx.resume()` + silent buffer, and prime `<audio>`. Set `audioSession.type="playback"` before tutor audio so the silent switch doesn't mute Web Audio. |
| TTS format | MP3 64 kbps (or Opus 32 kbps, since Chrome decodes Opus) | **MP3** (universal). Opus/Ogg only if `canPlayType('audio/ogg; codecs=opus')` (iOS 18.4+). |
| Live playback | One streamed `fetch` response with per-sentence clips → `decodeAudioData` → back-to-back `AudioBufferSourceNode`s | Same |
| "Slow" replay | `<audio>` + Blob of the concatenated sentence MP3s, `playbackRate=0.75`, `preservesPitch=true` (Chrome 86+) | Same. `preservesPitch` unprefixed on iOS 17.2+, `webkitPreservesPitch` earlier. |
| Avoid | MSE (two code paths), raw PCM (6× bandwidth) | Classic MSE (absent on iPhone). ManagedMediaSource only if long-utterance latency demands it. |

**Device test matrix before build sign-off:**
- Pixel/Samsung mid-range on Chrome stable over 4G.
- iPhone on iOS 18.x and iOS 26/27, in a Safari tab and as a home-screen PWA.
- Test cases: silent switch on, Bluetooth headset, output while the mic stream is open, permission persistence across app restarts.

### 10.4 DPDP compliance checklist (target: done before 13 May 2027; build it in from v1)

**Notice and consent**
- [ ] Standalone privacy notice (Rule 3):
  - itemised data list (Google profile: name, email, avatar; DOB/age confirmation; transcripts; optional audio; usage analytics; device and error data);
  - each purpose;
  - link and means to withdraw consent, exercise rights and complain to the Data Protection Board.
- [ ] Consent UI with a clear affirmative action. Not bundled: separate toggles for (a) core tutoring, (b) **optional 30-day audio retention**, (c) analytics and session replay if not strictly necessary.
- [ ] Withdrawal as easy as giving: a settings toggle, with processing stopped promptly after withdrawal.
- [ ] Offer the consent notice in **English plus at least Hindi**. The Act requires the *option* of any Eighth-Schedule language. Prioritise the languages of your target learners.
- [ ] Record consent events (who, what version, when) in an audit table.

**Children (under 18)**
- [ ] Neutral DOB age gate before account creation. Do not pre-fill it or reveal the cut-off.
- [ ] Block under-18s. Keep only an "18+ confirmed" flag and timestamp (Fourth Schedule Part B item 6 allows this minimal processing).
- [ ] Terms say 18+. Include a "report underage account" channel and a prompt deletion procedure.
- [ ] No marketing aimed at minors. No targeted advertising.
- [ ] Get legal review of whether self-declaration is sufficient before May 2027.

**Purpose, retention, erasure**
- [ ] Data map: what is stored, where (Supabase Mumbai, GCP Mumbai, OpenAI/TTS outside India, Sentry/PostHog regions) and for how long.
- [ ] Learner audio is **not stored by default**. Process it in memory and keep it out of logs and Sentry breadcrumbs.
- [ ] Opt-in audio is deleted at 30 days by a scheduled job. Make storage deletion verifiable.
- [ ] "Delete history" and "Delete account" remove transcripts and audio. Propagate to processors (PostHog person deletion, Sentry user data, OpenAI stored responses with `store=false`).
- [ ] **Rule 8(3) / 6(1)(e):** keep minimal processing logs (account ID, timestamps, consent records, request logs) for **1 year** in a restricted store, separately from content, then erase. **Get legal confirmation of scope.**

**Security (Rule 6)**
- [ ] Encryption in transit and at rest (Supabase/GCP defaults). RLS on every table. Service-role key server-only.
- [ ] Least-privilege IAM. Secrets in Secret Manager. Access logs retained ≥ 1 year.
- [ ] Backups (Supabase Pro daily, or `db dump` while on Free).
- [ ] Processor contracts and DPAs accepted: OpenAI, TTS vendor, Supabase, Google Cloud, Sentry, PostHog.

**Breach**
- [ ] Incident runbook: notify affected users without delay, notify the Board without delay, send the detailed Board report ≤ 72 h. CERT-In 6-hour report if applicable (get advice).
- [ ] Contact channel for users (email registered with the account).

**Rights and grievances**
- [ ] Published contact for privacy questions (Rule 9).
- [ ] Rights request flow:
  - access summary, including the **list of processors data was shared with**;
  - correction and erasure;
  - nomination.
- [ ] Grievance mechanism with a published SLA. Respond within **≤ 90 days**, and aim for 30.

**Cross-border**
- [ ] Disclose that STT/LLM/TTS processing happens outside India. OpenAI India residency is storage-only and does not cover processing.
- [ ] Watch for any s.16 restricted-country notification.

**Status watch**
- [ ] Check for any gazette notification shortening the 18-month window.
- [ ] Check the effect of the Removal of Difficulties Order (S.O. 5458(E)).
- [ ] Check any SDF notifications.

---

## Sources

All accessed 2026-10-14.

- [S1] Cloud Run pricing: https://cloud.google.com/run/pricing
- [S2] Google Cloud Free Program / Free Tier features: https://docs.cloud.google.com/free/docs/free-cloud-features
- [S3] VPC network pricing (internet egress, Premium Tier): https://cloud.google.com/vpc/network-pricing
- [S4] Cloud Run request timeout: https://docs.cloud.google.com/run/docs/configuring/request-timeout
- [S5] Cloud Run quotas and limits: https://docs.cloud.google.com/run/quotas
- [S6] Cloud Run "Invoke with an HTTPS request" (streaming), via search summary: https://docs.cloud.google.com/run/docs/triggering/https-request ; launch blog: https://cloud.google.com/blog/products/serverless/cloud-run-now-supports-http-grpc-server-streaming
- [S7] Cloud Run WebSockets: https://docs.cloud.google.com/run/docs/triggering/websockets
- [S8] Cloud Run CPU limits / startup CPU boost: https://docs.cloud.google.com/run/docs/configuring/services/cpu
- [S9] Cloud Run max instances: https://docs.cloud.google.com/run/docs/configuring/max-instances
- [S10] Spend cap budgets: https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps ; GA status via search of https://docs.cloud.google.com/billing/docs/release-notes
- [S11] Budgets and alerts: https://docs.cloud.google.com/billing/docs/how-to/budgets
- [S12] OneUptime blog (cold start estimate, Feb 2026): https://oneuptime.com/blog/post/2026-02-17-how-to-configure-minimum-instances-on-cloud-run-to-eliminate-cold-starts-for-production-services/markdown
- [S13] Cloud Run min instances: https://docs.cloud.google.com/run/docs/configuring/min-instances
- [S14] Cloud Run Next.js quickstart (via search summary): https://cloud.google.com/run/docs/quickstarts/frameworks/deploy-nextjs-service
- [S15] Next.js self-hosting guide (lastUpdated 2026-10-01): https://nextjs.org/docs/app/guides/self-hosting
- [S16] npm registry metadata: https://registry.npmjs.org/@opennextjs/cloudflare , https://registry.npmjs.org/vinext , https://registry.npmjs.org/next , https://registry.npmjs.org/@supabase/ssr
- [S17] Artifact Registry pricing: https://cloud.google.com/artifact-registry/pricing
- [S18] Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- [S19] Cloudflare Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
- [S20] OpenNext Cloudflare overview: https://opennext.js.org/cloudflare
- [S21] Cloudflare Website & Online Services Terms: https://www.cloudflare.com/website-terms/
- [S22] Cloudflare Service-Specific Terms, Developer Platform: https://www.cloudflare.com/service-specific-terms-developer-platform/
- [S23] OpenNext Cloudflare get started: https://opennext.js.org/cloudflare/get-started
- [S24] OpenNext Cloudflare known issues: https://opennext.js.org/cloudflare/known-issues
- [S25] Cloudflare Workers Next.js framework guide (vinext): https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- [S26] Search results: Workers error 1102 / OpenNext startup CPU (dev.to feed, Aug 2026): https://dev.to/feed/ricogr
- [S27] Vercel Fair Use Guidelines (last_updated 2026-09-14): https://vercel.com/docs/limits/fair-use-guidelines
- [S28] Vercel Hobby plan: https://vercel.com/docs/plans/hobby
- [S29] Render free instances: https://render.com/docs/free
- [S30] Railway plans: https://docs.railway.com/reference/pricing/plans
- [S31] Fly.io pricing: https://docs.fly.io/about/pricing
- [S32] Netlify pricing: https://www.netlify.com/pricing/
- [S33] Supabase pricing: https://supabase.com/pricing
- [S34] Supabase egress usage: https://supabase.com/docs/guides/platform/manage-your-usage/egress
- [S35] Supabase Edge Function limits: https://supabase.com/docs/guides/functions/limits
- [S36] Supabase Realtime limits: https://supabase.com/docs/guides/realtime/limits
- [S37] Supabase backups: https://supabase.com/docs/guides/platform/backups
- [S38] Supabase billing FAQ: https://supabase.com/docs/guides/platform/billing-faq
- [S39] Supabase regions: https://supabase.com/docs/guides/platform/regions
- [S40] Supabase Login with Google: https://supabase.com/docs/guides/auth/social-login/auth-google
- [S41] Sentry pricing: https://sentry.io/pricing/
- [S42] PostHog pricing: https://posthog.com/pricing
- [S43] PostHog product analytics pricing: https://posthog.com/docs/product-analytics/pricing
- [S44] GitHub Actions billing: https://docs.github.com/en/billing/concepts/product-billing/github-actions
- [S45] Upstash Redis pricing: https://upstash.com/pricing/redis
- [S46] MDN browser-compat-data v8.1.5 (timestamp 2026-10-08), via https://unpkg.com/@mdn/browser-compat-data/data.json (keys: MediaRecorder, applyConstraints.*_constraint, getSupportedConstraints, MediaSource, ManagedMediaSource, AudioSession, Navigator.getAutoplayPolicy, AudioContext, decodeAudioData, AudioWorklet, HTMLMediaElement.preservesPitch, Response.body)
- [S47] WebKit blog, Safari 18.4 features: https://webkit.org/blog/16574/webkit-features-in-safari-18-4/
- [S48] addpipe MediaRecorder API demo (codec table): https://addpipe.com/media-recorder-api-demo/ ; MDN MediaRecorder.mimeType: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/mimeType
- [S49] OpenAI speech-to-text guide: https://developers.openai.com/api/docs/guides/speech-to-text
- [S50] WebKit bugs 215884 / 212040: https://bugs.webkit.org/show_bug.cgi?id=215884 , https://bugs.webkit.org/show_bug.cgi?id=212040
- [S51] MDN Autoplay guide: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay
- [S52] Chrome autoplay policy: https://developer.chrome.com/blog/autoplay
- [S53] MDN Navigator.audioSession: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/audioSession
- [S54] WebKit bug 251532 (Web Audio muted by silent switch; audioSession.type workaround): https://bugs.webkit.org/show_bug.cgi?id=251532 ; W3C Audio Session: https://www.w3.org/TR/audio-session/
- [S55] WebKit blog, Safari 17.1 (ManagedMediaSource on iPhone): https://webkit.org/blog/14735/webkit-features-in-safari-17-1/
- [S56] OpenAI text-to-speech guide: https://developers.openai.com/api/docs/guides/text-to-speech
- [S57] ElevenLabs TTS stream API reference: https://elevenlabs.io/docs/api-reference/text-to-speech/stream
- [S58] MDN HTMLMediaElement.preservesPitch: https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/preservesPitch ; caniuse: https://caniuse.com/mdn-api_htmlmediaelement_preservespitch
- [S59] ricky0123/vad GitHub: https://github.com/ricky0123/vad ; npm: https://registry.npmjs.org/@ricky0123/vad-web ; file sizes: https://unpkg.com/@ricky0123/vad-web@0.0.31/dist/?meta
- [S60] onnxruntime-web 1.22.0 WASM (size measured): https://unpkg.com/onnxruntime-web@1.22.0/dist/ort-wasm-simd-threaded.wasm ; Silero VAD license (MIT) via https://api.github.com/repos/snakers4/silero-vad/license
- [S61] HN thread (iOS Safari OOM with in-browser Silero + ASR): https://brianlovin.com/hn/47995037
- [S62] **DPDP Rules, 2025, G.S.R. 846(E), Gazette of India, 13 Nov 2025 (English pp. 24–41)**: https://egazette.gov.in/WriteReadData/2025/267650.pdf
- [S63] Shardul Amarchand Mangaldas, "Enforcement of the DPDP Act and notification of the DPDP Rules": https://www.amsshardul.com/insight/enforcement-of-the-dpdp-act-and-notification-of-the-dpdp-rules/
- [S64] Search summaries of law-firm trackers on commencement (G.S.R. 843(E)) and interim regime: https://dpdpa.dcomply.in/rules/ , https://www.privybyidfy.com/blog/dpdp-compliance-guide-2026-what-indian-enterprises-must-do-before-may-2027
- [S65] dpdprules.org, "DPDP deadline: is the 18 month window being cut to 12 months?" (published 2026-09-01, reviewed 2026-10-12): https://dpdprules.org/blog/dpdp-18-months-to-12-months-proposal
- [S66] Foxmandal note on DPDP (Removal of Difficulties) Order, 2026, S.O. 5458(E) (via search summary): https://foxmandal.in/?p=60705
- [S67] **Digital Personal Data Protection Act, 2023 (No. 22 of 2023), Gazette text** (TRAI-hosted copy): https://www.trai.gov.in/sites/default/files/2024-09/DPDT_11082024.pdf ; India Code: https://www.indiacode.nic.in/bitstream/123456789/22037/2/a2023-22.pdf
- [S68] SS Rana & Co. (Bar & Bench), "MeitY notifies final DPDP Rules, 2025" (17 Nov 2025): https://www.barandbench.com/amp/story/law-firms/view-point/meity-notifies-final-digital-personal-data-protection-rules-2025 ; NALSAR Tech Law Forum on Rule 8(3): https://techlawforum.nalsar.ac.in/?p=2770
- [S69] CERT-In Directions 2022 summaries: Khaitan & Co: https://khaitanco.com/thought-leaderships/Indian-Computer-Emergency-Response-Team-Direction-Paradigm-Shift-in-Cyber-Incident-Reporting ; Linklaters: https://www.linklaters.com/en/insights/blogs/digilinks/2022/may/india-new-and-onerous-cyber-security-framework-and-breach-reporting-obligations
- [S70] Mansukhlal Hiralal & Co. (Legal 500), "Children's Data Protection Under India's DPDP Act": https://www.legal500.com/intelligence/india/privacy/childrens-data-protection-under-indias-dpdp-act-what-businesses-need-to-know
- [S71] Commentary on age assurance (draft and final Rules): Takshashila: https://takshashila.org.in/content/blogs/20251114-meity-notifies-dpdp-rules-2025.html ; MediaNama: https://www.medianama.com/2025/01/223-draft-dpdp-rules-2025-leave-doubts-age-verification-data-localisation/ ; AM Legals: https://amlegals.com/whatsapps-age-check-and-the-dpdp-act-what-section-9-means-for-childrens-data-compliance/
- [S72] IT (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011 (PRS copy): https://PRSINDIA.org/files/bills_acts/bills_parliament/2011/IT_Rules_2011.pdf
- [S73] Microsoft Learn, Azure Speech to text data, privacy and security: https://learn.microsoft.com/en-us/azure/ai-foundry/responsible-ai/speech-service/speech-to-text/data-privacy-security
- [S74] OpenAI "Data controls in the OpenAI platform": https://developers.openai.com/api/docs/guides/your-data
- [S75] ElevenLabs privacy policy: https://elevenlabs.io/privacy-policy
- [S76] ElevenLabs Zero Retention Mode: https://elevenlabs.io/docs/developers/resources/zero-retention-mode

### Not verified in this pass (open items)
- The asia-south1-specific Premium Tier egress rate (the page rendered only the us-central1 view).
- Whether the Cloud Run free tier offsets min-instance idle charges.
- Commercial-use terms for Supabase Free, Railway, Netlify Free and the Cloudflare Self-Serve Subscription Agreement.
- Fly.io Mumbai region.
- Sentry and PostHog data-residency options and DPAs.
- Codec support inside ManagedMediaSource on iOS.
- iOS output routing and volume while the mic stream is open.
- Current status of WebKit bug 215884 on iOS 26/27.
- Price of the Supabase custom-domain add-on.
- Whether ElevenLabs' training opt-out covers API traffic.
- Bitrates of OpenAI's mp3/opus TTS output.
