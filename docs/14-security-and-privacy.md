# 14 — Security & Privacy

> Related: [10 Data model §6](10-database-and-data-model.md) · [09 Architecture](09-system-architecture.md) · Evidence: [infra-browser-privacy §7–8, §10.4](research/notes/infra-browser-privacy.md)

> ⚖️ **Not legal advice.** This summarises India's DPDP Act 2023 and DPDP Rules 2025 as researched on 2026-10-14. Get a lawyer's review before public/commercial launch — several points below are flagged as needing legal confirmation.

---

## 1. Regulatory timeline (India)

| Date | What applies | Status |
|---|---|---|
| 13 Nov 2025 | DPDP Rules notified (G.S.R. 846(E)); Data Protection Board rules in force | VERIFIED (Gazette) |
| ≈ 13 Nov 2026 | Consent Manager rules (Rule 4) | VERIFIED |
| **≈ 13 May 2027** | **All substantive duties:** notice, security, breach notification, retention, children, rights, cross-border (Rules 3, 5–16, 22, 23) | VERIFIED; a proposal to shorten the window was reported but not notified as of 12 Oct 2026 |
| Until ≈ May 2027 | IT Act s.43A + SPDI Rules 2011 still apply to body corporates | REPORTED |

**Approach:** build DPDP-compliant flows **from v1** (they're cheap to build now, expensive to retrofit), and complete the legal review before May 2027 or before commercial launch, whichever is earlier.

---

## 2. Roles & processors

We are the **Data Fiduciary**. Each provider is a **Data Processor** and needs an accepted DPA/terms with security safeguards.

| Processor | Data | Location / retention (as researched) |
|---|---|---|
| Supabase | account, learner profile, transcripts, opt-in audio | **Mumbai (ap-south-1)** |
| Google Cloud Run / Logging / Secret Manager | request processing, logs (no transcripts) | **Mumbai (asia-south1)** |
| Deepgram (STT) | learner audio (in transit) | Processing location to confirm; `mip_opt_out=true` per request (training opt-out) |
| OpenAI (LLM) | transcripts, learner profile summary (no name/email) | Processing outside India; API data not used for training by default; `store: false`; abuse-monitoring logs up to 30 days for Responses/Chat; India residency = storage only, needs approval **VERIFIED** |
| Anthropic (failover LLM) | same as OpenAI when failover active | No training on API data by default **VERIFIED** |
| Microsoft Azure Speech (TTS) | tutor text (not learner data) | Real-time synthesis: text and audio **not stored** **VERIFIED** |
| Sentry | error data (scrubbed) | Region/DPA to confirm |
| PostHog | product events (no content), consent-gated | Region/DPA to confirm (EU or US cloud) |

If ElevenLabs is chosen later: data retained by default, zero-retention is enterprise-only, US storage — disclose and minimise (tutor text only).

---

## 3. Notice, consent & age gate

### 3.1 Age gate (children = under 18 under DPDP)

DPDP prohibits processing children's data without verifiable parental consent and bans tracking/behavioural monitoring of children — our adaptive tutoring and analytics would arguably count. The law prescribes no method for adult-only services; commentary is split on whether self-declaration suffices **REPORTED**. Confirming age is itself an allowed minimal processing (Fourth Schedule Part B item 6) **VERIFIED**.

**Implementation (replaces the plain checkbox in [02 §4.2](02-user-journeys-and-ux.md)):**
1. Before account creation completes: neutral **date-of-birth** entry (no pre-fill, no hint of the cut-off).
2. Under 18 → block, sign out, no profile stored; message "Lactice is for adults only for now."
3. Store only `adult_confirmed_at` (no DOB).
4. Terms state 18+; "Report an underage account" link → prompt deletion procedure.
5. No marketing aimed at minors; no targeted advertising at all.
6. Legal review of sufficiency before May 2027.

### 3.2 Notice (Rule 3) — standalone, plain language

Itemised data list (Google name/email/avatar; age confirmation; target/native language, level, goals; transcripts and corrections; optional audio; usage analytics; device/error data), each purpose, processors and locations (including processing outside India), retention periods, how to withdraw consent, exercise rights and complain to the Data Protection Board, grievance contact. **Available in English and Hindi** (the Act requires the option of English or any Eighth-Schedule language; prioritise learners' languages over time).

### 3.3 Consent (separate, unbundled, withdrawable)

| Consent | Default | Withdrawal |
|---|---|---|
| Core tutoring (process voice → transcripts, adaptive learning) | required to use the product | delete account |
| Keep my voice recordings 30 days to improve the tutor | **off** | settings toggle; existing clips deleted immediately |
| Product analytics & error diagnostics beyond strictly necessary | off until accepted (banner) | settings toggle |

Every grant/withdrawal → `consent_events` (kind, version, timestamp).

---

## 4. Data minimisation & retention

- **Learner audio:** processed in memory; never in logs, Sentry breadcrumbs or analytics; persisted only with opt-in (private bucket, 30-day purge job).
- **LLM prompts** contain first name only (for greetings) — no email, no IDs; OpenAI `safety_identifier` = salted hash of user id.
- **Transcripts** never sent to analytics; logs carry ids, categories and metrics only.
- **IP addresses** stored only as HMAC hashes for abuse limits.
- **No voice biometrics:** no speaker identification or voice embeddings of learners (voice evaluation embeddings are computed only on *tutor* TTS audio).
- Retention table: [10 §6](10-database-and-data-model.md).

### ⚠️ Rule 8(3) minimum retention — needs legal confirmation

Rule 8(3) requires retaining "personal data, associated traffic data and other logs of the processing" for **at least one year** from processing, with an illustration saying this applies **even if the user deletes her account** **VERIFIED (text)**; scope is debated **REPORTED**. This collides with our "delete account" promise.

**Interim design (pending legal advice):**
- On deletion, **content** (transcripts, corrections, vocab, audio, profile) is erased as promised.
- A minimal **processing-log record** (pseudonymous user id, account created/deleted timestamps, consent events, request logs without content) is moved to a restricted `compliance_logs` table and erased after 1 year.
- The privacy notice states this explicitly.
- Revisit once a lawyer confirms the scope.

---

## 5. Data principal rights

| Right | Implementation | SLA |
|---|---|---|
| Access/summary incl. list of processors data was shared with | Settings → "Download my data" (JSON export) + processors list in the notice | immediate export; written requests ≤ 30 days (law: ≤ 90) |
| Correction | Profile/settings edits; support request for others | ≤ 30 days |
| Erasure | Delete session / delete history / delete account (§4 caveat) | content immediately in-app; backups/processors ≤ 30 days |
| Withdraw consent | Toggles (§3.3) | immediate |
| Nomination | Support request process documented | ≤ 30 days |
| Grievance | Published contact email + form; tracked in a simple log | acknowledge ≤ 7 days, resolve ≤ 30 days (law: ≤ 90) |

---

## 6. Breach response

Runbook (`docs/runbooks/breach.md`, created in Phase 6):
1. Contain (rotate keys, revoke sessions, block route).
2. Assess scope from logs.
3. Notify **each affected user without delay** (what happened, likely consequences, mitigation, steps they can take, contact).
4. Notify the **Data Protection Board without delay**, detailed report **within 72 hours**.
5. CERT-In 6-hour reporting may apply — get advice on applicability for a sole developer **REPORTED**.
6. Post-mortem.

---

## 7. Security controls

| Area | Control |
|---|---|
| Secrets | Provider keys and Supabase service-role key in GCP Secret Manager → env at runtime; never `NEXT_PUBLIC_*`; gitleaks in CI; rotate quarterly and on any suspicion |
| AuthN | Supabase Auth (Google OAuth, PKCE); short-lived JWT; HttpOnly secure cookies; relative-only redirects |
| AuthZ | Every API checks ownership; RLS on every table (select-own policies; service-role writes); admin allow-list; SQL tests for RLS policies |
| Input validation | Zod on all bodies; audio MIME sniffing + size/duration caps; reject unknown fields |
| Prompt injection | Learner transcript is passed as data inside a delimited field; the tutor has no tools and no access to other users' data; output is schema-constrained and validated; moderation on input and output |
| Abuse & cost | Rate limits ([09 §8](09-system-architecture.md)), trial per account + IP-hash guard, turn cap per session, budget kill switch, Cloud Run spend cap + max instances, provider-side monthly limits |
| Transport | HTTPS only; HSTS; strict CSP (self + Supabase + PostHog + Sentry hosts; `media-src blob:`); `Permissions-Policy: microphone=(self)` |
| Dependencies | Renovate/Dependabot; `npm audit` gate on high/critical; lockfile committed |
| Logging | Structured logs without content; access logs retained ≥ 1 year (Rule 6) in Cloud Logging bucket with restricted access |
| Backups | Supabase Pro daily (7 days) from launch; during private beta weekly `supabase db dump` via GitHub Action to encrypted storage; quarterly restore test |
| Admin | Admin page behind allow-list + re-auth for exports; audit log of admin actions |

---

## 8. Threat model (top risks)

| Threat | Impact | Mitigation |
|---|---|---|
| Stolen provider keys → runaway spend | Budget blown | Secret Manager, server-only keys, provider spend limits, kill switch, alerts |
| Bot/abusive accounts farming trial minutes | Budget | Google sign-in, IP-hash guard, VAD-gated uploads, rate limits, turn cap |
| Another user's transcripts exposed | Privacy breach | RLS + ownership checks + tests; no client writes |
| Minors using the service | DPDP children's duties | DOB gate, report channel, deletion procedure, legal review |
| Prompt injection via speech ("ignore instructions…") | Off-brand or unsafe replies | No tools/data access, schema validation, moderation, template fallbacks |
| Processor retention beyond promise | Trust/legal | Choose processors with no-retention options; disclose; minimise data sent |
| Learner audio leaking into logs | Privacy | Lint rule + code review: audio buffers never passed to logger/Sentry; Sentry `beforeSend` scrubbing |

---

## 9. Pre-launch privacy & security checklist (G4)

- [ ] Privacy notice (EN + HI) and Terms (18+) published; versioned.
- [ ] DOB age gate; under-18 block; report channel.
- [ ] Separate consents recorded; withdrawal works and stops processing.
- [ ] Data map complete (what, where, how long, which processor).
- [ ] DPAs/terms accepted for all processors; Deepgram `mip_opt_out` verified in requests; OpenAI `store:false` verified.
- [ ] Opt-in audio purge job verified (object really deleted).
- [ ] Delete history/account verified end-to-end incl. analytics deletion; compliance-log handling per legal advice.
- [ ] Rule 8(3) / 6(1)(e) retention scope confirmed by a lawyer.
- [ ] Breach runbook written; contact channel live.
- [ ] RLS tests, authz tests, secret scan, dependency audit clean.
- [ ] Backups + restore test.
- [ ] Watch list: gazette changes to DPDP timelines; s.16 restricted-country notifications.
