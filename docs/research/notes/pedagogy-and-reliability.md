# Pedagogy and reliability research notes

**Product:** AI voice language tutor for Indian adults (Japanese and German A1–B2, English A2–B2)
**Phase:** Planning (no code)
**Compiled:** 2026-10-14. All URLs accessed 2026-10-14 unless stated otherwise.

## How to read the evidence labels

- **VERIFIED**: I read the primary source, or an official document, or a reliable reproduction of the primary text, during this session.
- **REPORTED**: The claim comes from abstracts, search-engine summaries, secondary sources, or standard citations I did not re-read here. Check it before quoting it externally.
- **PRACTITIONER / ASSUMPTION**: Professional teaching practice or my own design inference. There is no specific empirical source behind it.

I have not invented any numbers. Where I could not confirm a figure, I say so.

---

## Executive summary (decision-relevant)

1. **Recasts alone are weak for adults; recasts plus an explicit card plus "Try again" is well supported.** Here is the evidence:
   - In Lyster & Ranta (1997), recasts made up 55% of teacher feedback but yielded **0 student-generated repairs**. Of 375 recasts, 66 were followed by any repair (≈18%). Elicitation produced repair in 43 of 94 cases (≈46%).
   - Two meta-analyses favour more explicit feedback and prompts over recasts: Lyster & Saito (2010) found prompts > recasts, and Ellis, Loewen & Erlam (2006) found explicit metalinguistic feedback > recasts.
   - The planned design maps well onto this. The spoken recast is the implicit move. The on-screen card is explicit or metalinguistic feedback. "Try again" is a prompt (elicitation) that produces student-generated repair.
2. **Learners want more correction than teachers usually give** (Lyster, Saito & Sato 2013, REPORTED). This supports offering a Strict mode and an end-of-session summary. It does not support correcting everything aloud.
3. **The biggest reliability risk is the correction pipeline, not the pedagogy:**
   - LLMs over-correct and make fluency rewrites on minimal-edit tasks (Fang et al. 2023; Davis et al. 2024; Karpo & Chernodub 2026).
   - ASR on learner speech is worse than on native speech: 39.5% vs 19.6% WER in Bohus & Rudnicky (2005). Modern Whisper-class systems still show native/non-native gaps (Graham & Roll 2024).
   - ASR language models *normalise toward grammatical text*. That hides real errors (false negatives) and also creates false edits.
   - Design response: a strict precision gate (ASR-confidence, multi-sample agreement and rule checks) that is **the same at every strictness level**.
4. **The evidence argues against plain "please repeat" requests.** Bohus & Rudnicky (2005) compared ten recovery strategies. Plain AskRepeat (33.7% recovery) and silence (31.2%) were among the worst. MoveOn (64.4%), FullHelp (58.5%) and TerseYouCanSay (56.5%) were the best.
   - **Recommendation:** Change "ask to repeat up to 2×" to: one repeat/rephrase request (with a partial echo of what was heard, if any), then a "You can say: …" model, then move on.
5. **Self-assessment is only a weak prior.** Meta-analytic correlations with external measures are about r ≈ .47 overall and ≈ .44 for speaking (Li & Zhang 2021). Ross (1998) reports about .63 overall and .55 for speaking.
   - Show levels as a band ("likely A2–B1"), update quickly in the first sessions, then slowly, with hysteresis.
   - An LLM CEFR rating is a noisy signal, not ground truth. It depends on L1 and varies from run to run.
6. **Do not treat legitimate Indian English as an error.** Examples: extended stative progressive ("I am having two brothers"), invariant "isn't it", and article patterns. eWAVE codes the stative progressive as pervasive in Indian English. LLMs are documented to default to "standard" US/UK English (Fleisig et al. 2024). Use an explicit allowlist.
7. **Copyright and licensing check needed:**
   - The Council of Europe holds copyright on CEFR descriptors, and commercial reuse needs written permission. **Paraphrase, don't copy, and get legal sign-off.**
   - Goethe word lists are copyrighted.
   - ts-fsrs is MIT-licensed.
8. **JLPT does not measure speaking.** The official JLPT→CEFR reference levels (shown on score reports from Dec 2025) cover only reception and linguistic competence. Never map a learner's JLPT level directly to a speaking estimate.

---

## 1. Corrective feedback: recasts vs prompts vs explicit correction

### 1.1 Lyster & Ranta (1997): taxonomy and uptake (REPORTED via a detailed contemporaneous summary)

**Source:** Lyster & Ranta (1997), *SSLA* 19, 37–66. Figures are from Tedick & de Gortari (1998), which reproduces the study's Table 1. I could not access the original article.

**Setting:** French immersion, Grades 4–5, about 18 hours of lessons.

**Overall figures:**
- 34% of student utterances contained an error.
- Teachers gave feedback on 62% of errors.
- 55% of feedback moves led to uptake.
- Only 27% of feedback moves led to repair.
- Only 17% of all errors were eventually repaired.

**Distribution of feedback types:**

| Type | Share |
|---|---|
| Recasts | 55% |
| Elicitation | 14% |
| Clarification requests | 11% |
| Metalinguistic | 8% |
| Explicit correction | 7% |
| Repetition | 5% |

**Repairs by feedback type** (Table 1 as reproduced):

| Feedback type (n) | All repairs | Student-generated repairs |
|---|---|---|
| Recast (375) | 66 | 0 |
| Elicitation (94) | 43 | 43 |
| Clarification request (73) | 20 | 20 |
| Metalinguistic (58) | 26 | 26 |
| Explicit correction (50) | 18 | 0 |
| Repetition (36) | 11 | 11 |

- **Interpretation (authors' and summarisers'):** "Prompts" withhold the correct form and push learners to self-repair ("negotiation of form"). Recasts and explicit correction give the answer, so any repair is only a repetition.
- **Caveat:** These are child immersion classrooms. Uptake and repair are not the same as acquisition.
- **Design note:** A learner can only *repeat* a recast. "Try again", where the learner reformulates *before* seeing the answer, is the elicitation analogue.

### 1.2 Meta-analyses

**Russell & Spada (2006)** (REPORTED, figure as cited by Lyster & Saito 2010)
- About 15 CF studies.
- Overall effect d = 1.16 ("very large").

**Mackey & Goo (2007)** (REPORTED, same secondary source)
- 28 interaction studies.
- Feedback effect d = 0.71 on immediate post-tests and 1.09 on delayed post-tests.
- Classroom effects were smaller than lab effects (d ≈ 0.57 immediate, 0.76 delayed).

**Lyster & Saito (2010)**, *SSLA* 32(2), 265–302 (VERIFIED abstract)
- 15 classroom studies, N = 827.
- CF had significant and durable effects.
- **Prompts outperformed recasts.** Effects were largest on free, constructed-response measures.
- Setting (second-language vs foreign-language classroom) did not matter.
- Younger learners benefited more than older ones.
- Per a secondary summary: medium effects for recasts and large effects for prompts.

**Li (2010)**, *Language Learning* 60(2), 309–365 (REPORTED abstract)
- 33 studies; overall medium effect, maintained over time.
- Lab effects were larger than classroom effects.
- Foreign-language contexts outperformed second-language contexts.
- **Implicit feedback effects were better maintained over time than explicit ones.** This counters a simple "explicit always wins" reading.
- I did not verify the exact d values.

**Ellis, Loewen & Erlam (2006)**, *SSLA* 28(2), 339–368 (REPORTED abstract)
- Low-intermediate adult ESL learners; English past -ed.
- **Explicit metalinguistic feedback outperformed recasts** on delayed imitation and grammaticality-judgement tests.
- It benefited both implicit and explicit knowledge.

**Replication caution** (REPORTED): A 2023 multisite replication of Yang & Lyster (2010) found no advantage for either prompts or recasts. Effects are context-sensitive.

### 1.3 What makes a recast noticeable (REPORTED)

Sheen (2006), *Language Teaching Research* 10(4), 361–392, as summarised by others: recasts that are **short, declarative, reduced to the erroneous part, and single-error-focused** were more strongly associated with uptake and repair. A recast followed by a second feedback move is more salient.

### 1.4 Timing: immediate vs delayed (REPORTED, unresolved)

Relevant studies:
- Li, Zhu & Ellis (2016), *MLJ* 100, 276–295: immediate vs delayed (after-task) CF.
- Fu & Li (2022), *SSLA* 44(1), 2–34.
- A 2025 approximate replication reportedly found an advantage for *interim* over *delayed* feedback, for explicit knowledge on the immediate post-test.

I could not verify these findings in detail. **Treat timing as unresolved.** The planned combination (one in-the-moment recast, cards during the session, then a summary) hedges across both.

### 1.5 Learner preferences (adults)

- **Lyster, Saito & Sato (2013)**, *Language Teaching* 46(1), 1–40 (REPORTED abstract): learners tend to want **more** CF than teachers think they should provide.
- **Bao & Wang (2023)**, *Frontiers in Psychology* 14 (VERIFIED): 328 learners of Chinese as a second language and 46 teachers.
  - Students preferred **explicit correction and metalinguistic clues**. Teachers favoured recasts.
  - Teachers reported focusing on errors that affect understanding.
- **Indian adult learners** (PRACTITIONER / ASSUMPTION): Many Indian adults come from exam-oriented, teacher-fronted schooling and will likely value explicit, rule-referenced feedback. Validate this in user research.

### 1.6 Which errors to target

- Aljaafreh & Lantolf (1994) (VERIFIED) chose target structures that had "a high probability of recurrence" (articles, tense, prepositions, modals). This supports prioritising **recurring** errors.
- Prioritising errors that **impede comprehension** over local slips is common practice (PRACTITIONER; the "global vs local errors" distinction is classic but I did not re-verify it).

### 1.7 Implications for the planned correction policy

| Planned element | Evidence fit | Adjustment |
|---|---|---|
| ≤1 spoken recast per turn | Recasts often go unnoticed. Short, single-focus recasts are more salient (Sheen 2006). | Make the recast short and partial, focused on one form, in declarative intonation, then continue the conversation. Never recast more than one error. |
| On-screen card + short explanation | Explicit/metalinguistic CF outperforms recasts (Ellis et al. 2006). Adult learners prefer explicit CF (Bao & Wang 2023). | Card = the error span, the correct form, a ≤15-word rule, and one example. |
| "Try again" | Prompts produce student-generated repair (Lyster & Ranta 1997; Lyster & Saito 2010). | Offer "Try again" **before** revealing the correct form where possible ("Tap to see answer"). Log repair success. |
| End-of-session summary | Timing evidence is mixed. A summary moves extra errors out of the conversation. | Put non-priority errors here. Group them by error type. |
| Strictness levels | Learners want more CF than teachers give. | Strictness changes *how many and which categories* are surfaced, **never** the precision gate (§11). |

---

## 2. Interaction, output, input and talk ratio

### 2.1 Theory (REPORTED; standard citations, not re-read)

- **Interaction Hypothesis** (Long 1996): Negotiation for meaning (clarification requests, confirmation checks) makes input comprehensible and draws attention to form.
- **Output Hypothesis** (Swain 1985, 1995): Producing output promotes noticing gaps, hypothesis testing and metalinguistic reflection. This is the theoretical basis for maximising *learner* speaking and for "Try again".
- **Comprehensible input** (Krashen 1985): Input slightly beyond current level. In practice this means tutor turns calibrated to the learner's level.
- Mackey & Goo's (2007) interaction meta-analysis (above) supports interaction plus feedback as facilitative (REPORTED).

### 2.2 Question type

- **Brock (1986)**, *TESOL Quarterly* 20(1), 47–59 (REPORTED): learners asked more *referential* (genuine-information) questions gave longer and more syntactically complex answers than learners asked *display* questions. The sample was small (4 teachers, 24 learners).
- **Implication:** Prefer open, referential questions from A2+. At A1, use closed or either/or questions with an easy expansion path (PRACTITIONER).

### 2.3 Wait time and turn-taking

- **Rowe (1986)**, *J. Teacher Education* 37(1), 43–50 (REPORTED): Teachers typically wait about 1 s. Raising the wait to about 3 s or more increased response length, unsolicited appropriate responses and speculative thinking, and reduced non-responses.
- **Stivers et al. (2009)**, *PNAS* 106(26), 10587–10592 (REPORTED abstract): Across 10 languages, speakers avoid overlap and minimise silence. Mean gaps vary within about a 250 ms range of the cross-language mean. L2 learners need much longer planning time than this native norm.
- **Implication:** Tap-to-talk avoids end-of-turn detection cutting learners off. Keep that. The silence ladder (hint pulse at ~10 s, nudge at ~25 s) is consistent with "wait well beyond 3 s" for planning in L2 (ASSUMPTION; no study tests these exact thresholds for voice tutors). Make them configurable and A/B test them.

### 2.4 Talk ratio and tutor turn length (no direct evidence)

I found no well-sourced optimal learner:tutor talk ratio for one-to-one AI tutoring. The rules below are PRACTITIONER / ASSUMPTION, derived from the output and input arguments and the CEFR descriptors (§4).

| Level | Tutor turn (target language) | Question style | Target learner share of speaking time |
|---|---|---|---|
| A1 | 1–2 short sentences, about ≤12 words, high-frequency vocabulary, slow TTS | yes/no, either/or, "What's your …?" + model answer available | ≥40% |
| A2 | ≤2 sentences, about ≤20 words | simple wh- questions about routine and personal topics | ≥50% |
| B1 | ≤3 sentences | open "why/how/tell me about" questions, describing experiences | ≥60% |
| B2 | ≤3–4 sentences | opinion and justification, advantages and disadvantages, hypotheticals | ≥60–70% |

- **Universal rules:**
  - Each tutor turn ends with exactly **one** question or invitation.
  - The tutor never answers its own question.
  - If the recast is used, it comes first, then a brief content response, then the question.
- **Measure** learner speaking-time share per session. Alert (internally) if the tutor exceeds its budget.

---

## 3. Scaffolding and hint ladders

### 3.1 Aljaafreh & Lantolf (1994) (VERIFIED)

**Source:** *Modern Language Journal* 78(4), 465–483. Adult ESL writing tutorials.

**Regulatory scale:** 13 levels (0–12), from implicit to explicit:
- 0: learner self-corrects alone
- 1: tutor present ("collaborative frame")
- 2: focused reading of the sentence
- 3: "anything wrong in this sentence?"
- 4: rejects unsuccessful attempts
- 5: narrows the location
- 6: indicates the nature of the error ("something wrong with the tense")
- 7: identifies the error
- 8: rejects attempts
- 9: gives clues
- 10: provides the correct form
- 11: gives an explanation
- 12: gives examples

**Principles:** Help should be **graduated** (start implicit and become explicit only as needed) and **contingent** (offered only when needed, withdrawn when the learner shows self-control).

**Development criterion:** Over time, the learner needs *less explicit* help for the same structure. Five transitional levels run from "cannot notice or correct even with help" to "fully self-regulated, automatic".

**Same error, different needs:** Different learners with the "same" error needed very different help levels (protocols C vs D). Identical surface errors do not mean identical needs.

### 3.2 Dynamic assessment (REPORTED)

Computerized dynamic assessment (Poehner & Lantolf and colleagues) attaches **graduated prompts (implicit→explicit)** to each item. It reports an *actual score* (unassisted) and a *mediated score* (reflecting how much help was needed). Decreasing reliance on explicit prompts is read as development. I did not verify the exact number of prompts or the scoring formula.

### 3.3 Implications

- **The planned hint ladder** (contextual hint → sentence starter → full example) is a compressed 3-step version of levels 6/9 → 9 → 12. Add an implicit "step 0": the hint button pulses and nothing is revealed. **Three or four steps is reasonable.** The evidence does not prescribe a number (ASSUMPTION).
- **Independence signal:** Log the highest hint level used per learner turn (0 = none … 3 = full example). Turn this into an **independence score** = 1 − (mean hint level / 3) over a rolling window. Track it per skill and, where possible, per structure ("needed a sentence starter for past tense last week, none this week" is evidence of development in the A&L sense).
- **Card follow-through:** Apply the same logic to "Try again". Record whether the learner repaired after the card alone (implicit) or after revealing the answer (explicit).

---

## 4. Level frameworks and self-assessment

### 4.1 CEFR self-assessment grid (VERIFIED; Europass reproduction © EU & Council of Europe 2004–2020)

Key verified wording, abridged:

- **Spoken interaction**
  - A1: "interact in a simple way provided the other person is prepared to repeat or rephrase things at a slower rate of speech and help me formulate what I'm trying to say"
  - A2: "communicate in simple and routine tasks … handle very short social exchanges"
  - B1: "enter unprepared into conversation on topics that are familiar…"
  - B2: "interact with a degree of fluency and spontaneity … take an active part in discussion … accounting for and sustaining my views"
- **Spoken production**
  - A1: simple phrases to describe where I live and people I know
  - A2: a series of phrases to describe family, living conditions, education, job
  - B1: connect phrases to describe experiences, events, dreams; briefly give reasons; narrate a story
  - B2: clear, detailed descriptions; explain a viewpoint with advantages and disadvantages
- **Listening**
  - A1: familiar words when people speak slowly and clearly
  - A2: high-frequency phrases on immediate topics
  - B1: main points of clear standard speech on familiar matters
  - B2: extended speech, complex argument on familiar topics

I could not download the CEFR Companion Volume (2020) PDF (HTTP 403). The CV's illustrative-descriptor scales ("Overall spoken interaction", "Overall oral production") are not quoted here.

### 4.2 Plain-language onboarding can-do statements (my paraphrase; PRACTITIONER)

These are paraphrased and simplified, not verbatim CEFR. Ask the learner to tick "Yes / With help / Not yet".

| Level | Speaking: "In [language], I can…" | Listening |
|---|---|---|
| A1 | say hello, my name, where I'm from and live; answer very simple questions about myself if the other person speaks slowly and helps me | understand familiar words when people speak slowly and clearly |
| A2 | talk about my family, work or studies and daily routine in short sentences; handle short everyday exchanges (shopping, directions) | understand short, clear everyday phrases and the main point of simple messages |
| B1 | join a conversation on familiar topics without preparing; describe an experience or a plan and give a short reason; retell a story or film | follow the main points of clear speech about familiar topics |
| B2 | keep a conversation going fluently on many topics; give and defend an opinion with pros and cons | follow longer talks and discussions on familiar topics |

- **Licensing (VERIFIED general policy):** The Council of Europe holds CEFR copyright. Reproduction needs written permission, which is generally granted for **non-commercial** use. Commercial use needs prior written authorisation.
- **Action:** Use original paraphrases, cite CEFR as the basis without implying endorsement, and get legal review or CoE permission before launch.

### 4.3 Japanese: JF Standard and JLPT

- **JF Standard (VERIFIED, Japan Foundation):**
  - Six levels **A1–C2, the same as CEFR**.
  - Two kinds of Can-do: "CEFR Can-dos" (abstract) and "JF Can-dos" (concrete Japanese-use situations).
  - Searchable in the "Minna no Can-do" site. Marugoto coursebooks are built on it.
  - Recommended source for Japanese-specific can-do wording. Check the reuse terms.
- **JLPT→CEFR reference (VERIFIED, jlpt.jp):** Shown on score reports from the **December 2025** test, for passers only. Standard setting was held October 2024.

| JLPT | Total score | CEFR |
|---|---|---|
| N5 | ≥80 | A1 |
| N4 | ≥90 | A2 |
| N3 | 95–103 | A2 |
| N3 | ≥104 | B1 |
| N2 | 90–111 | B1 |
| N2 | ≥112 | B2 |
| N1 | 100–141 | B2 |
| N1 | ≥142 | C1 |

- **Caveat (official):** This is reference information only. It covers only "Linguistic" and "Reception" competences, **not speaking, writing or interaction**.
- **Product rule:** If a learner says "I passed N4", use it only as a prior for comprehension and vocabulary. Never use it as a speaking level.

### 4.4 German: Goethe-Institut

- Goethe exams are aligned to CEFR A1–C2 (REPORTED).
- Goethe-Zertifikat A1 (Start Deutsch 1) speaking, per goethe.de pages (REPORTED via search): a group format; introduce yourself, ask and answer everyday questions, make requests and respond.
- Official Goethe word lists exist for A1, A2 and B1 (REPORTED). They are copyrighted, so they can serve as a scope reference, not for redistribution.
- I could not verify official word counts per level. Unverified figures circulate online; do not use them.

### 4.5 Vocabulary size by level (VERIFIED, with limits)

**Source:** Milton & Alexiou (2010, GALA), reproducing Milton & Alexiou (2009). Indicative X_Lex estimates, out of the most frequent 5,000 lemmas:

| CEFR | English | French | Greek (64 learners) |
|---|---|---|---|
| A1 | <1500 | 1160 | 1486 |
| A2 | 1500–2500 | 1650 | 2237 |
| B1 | 2750–3250 | 2422 | 3288 |
| B2 | 3250–3750 | 2630 | 3956 |

- The figures differ by language, and within-level overlap is large.
- **No verified equivalent figures for German or Japanese** were found.
- Use these only as rough sanity checks for the English track.

### 4.6 How reliable is self-assessment?

- **Ross (1998)**, *Language Testing* (REPORTED): 10 studies, 60 correlations; mean r ≈ .63; speaking ≈ .55. Receptive skills correlated more strongly than productive skills.
- **Li & Zhang (2021)**, *Language Testing* 38(2), 189–218 (REPORTED abstract):
  - 67 studies, 97 samples, more than 68,500 participants.
  - Overall r = .466; speaking ≈ .44.
  - Correlations were stronger when items described **concrete real-life tasks**, came with criteria or rubrics, or followed training.
- **Implication:**
  - Use **concrete, situation-based** can-do items, not "Rate your speaking 1–5".
  - Treat the result as a weak prior.
  - Let the first 2–3 sessions dominate the estimate (§8).

---

## 5. LLM grammatical error correction (GEC) reliability

### 5.1 Over-correction evidence

- **Fang et al. (2023)**, arXiv 2304.01746 (REPORTED abstract): ChatGPT has excellent error *detection* but tends to over-correct and not follow minimal edits. It gets the highest recall but the lowest precision and F0.5 on minimal-edit benchmarks.
- **Coyne et al. (2023)**, arXiv 2303.14342 (VERIFIED abstract): GPT-3.5 and GPT-4 do well in a sentence-level *revision* setting. GPT-4 set a new high score on **JFLEG**, a fluency benchmark. The authors note differences in editing strategy against references. Over-correction details are in the full text, which I did not read.
- **Loem et al. (2023)**, BEA, pp. 205–219 (REPORTED): GPT-3 output is **controllable** with instructions and examples (minimal vs fluency edits, learner level).
- **Davis et al. (2024)**, ACL Findings (VERIFIED abstract): 7 open-source and 3 commercial LLMs on 4 benchmarks.
  - LLMs do not always beat supervised GEC.
  - Commercial LLMs win mainly on **fluency-annotated** benchmarks.
  - **Several open models beat commercial ones on minimal-edit benchmarks.**
- **Karpo & Chernodub (2026)**, EMNLP Findings, arXiv 2609.10810 (VERIFIED abstract):
  - Zero- and few-shot LLMs **rewrite already well-formed text**, which lowers F0.5.
  - **Taxonomy-based instructions listing grammatical error rules** limit edits, most for the strongest models.
  - **Batching** several sentences reduces the edit rate.
  - Optimised prompting with Gemini 3.1-Pro reached F0.5 78.32 on BEA-2019, 0.38 below the fine-tuned state of the art.
- **Goto, Sakai & Watanabe (2026)**, BEA, arXiv 2605.13624 (VERIFIED abstract): **Edit-level majority voting** across multiple samples from one LLM mitigates over-correction. It beats greedy and MBR decoding in most of 9 benchmarks, covering English, Czech, **German**, Ukrainian, Korean, **Hindi** and Romanian. Training-free.

### 5.2 Explanations

**Song et al. (2024)**, "GEE!", NAACL Findings (VERIFIED arXiv abstract):
- One-shot GPT-4 explained only about 60% of errors.
- A **two-step pipeline** works much better: first extract atomic token edits, then generate a one-sentence explanation per edit. Human-judged correctness was **93.9% for German** and 98.0% for Chinese explanations.
- **Implication:** Separate "find the edit" from "explain the edit". Explain one atomic edit at a time.

### 5.3 Self-verification and confidence

- **Huang et al. (2024)**, ICLR (REPORTED abstract): LLMs struggle to self-correct reasoning **without external feedback**, and performance can degrade.
  - Implication: "Ask the same model to double-check" is not a reliable precision gate on its own.
  - Use structured external signals: ASR confidence, rule checks, agreement across independent samples or models.
- **Xiong et al. (2024)**, ICLR (REPORTED abstract): **Verbalised** LLM confidence is systematically overconfident (clustered at 80–100%). Sampling-based consistency helps calibration. **Do not gate corrections on the model's self-reported confidence.**

### 5.4 Japanese- and German-specific evidence

- **German:**
  - Falko-MERLIN is the standard learner-German GEC benchmark (REPORTED). Majority voting was tested on German (above).
  - GEE achieved 93.9% correct explanations on German learner data.
  - An "Encode Errors" retrieval paper (arXiv 2606.15416, REPORTED) attributes its German gains mainly to **fewer false positives**.
- **Japanese:**
  - Koyama et al. (2020, LREC) built an evaluation corpus for JSL learner GEC (REPORTED). They argue Lang-8 corrections are unreliable as references.
  - A human-evaluation study of a sequence tagger (arXiv 2402.18101, REPORTED) shows a high-precision, low-recall profile.
  - **I found no rigorous 2024–2026 benchmark of frontier LLMs on Japanese *learner* GEC.** This is an evidence gap. Build an in-house evaluation set.

### 5.5 Spoken GEC on ASR output

- **Qian, Ma, Bannò, Gales & Knill (2025)**, arXiv 2506.18532 (VERIFIED abstract): Cascaded ASR → disfluency removal → GEC suffers from **error propagation**. They propose (a) **removing hypothesised edits caused by transcription errors** and (b) **edit confidence estimation to drop low-confidence edits**. Evaluated on Linguaskill and **Speak & Improve**.
- **Speak & Improve Corpus 2025** (Knill et al.) and the Challenge (Qian et al.), arXiv 2412.11986 / 2412.11985 (REPORTED): about 315–340 h of L2 English (A2–C1), with a ~55–60 h subset carrying manual transcription, disfluencies and GEC. This is a candidate English evaluation resource; check the licence.
- **Kumar, Sirigiraju, Vaideeswaran, Ghosh & Yarra (SLaTE 2023)** (VERIFIED abstract):
  - Commercial ASR language models are **biased toward grammatically correct text**, so decoded text under-reveals spoken errors.
  - **Word-level confidence scores** gave a 15.36% relative improvement in spoken grammatical error detection.
- **LearnerVoice (Kim et al., Interspeech 2024)** (VERIFIED abstract): 50 h of L2 English spontaneous speech. 54.2% of vanilla Whisper errors were attributable to L2 spontaneous-speech features. Fine-tuning cut WER by 44.2% (to 10.26%).

---

## 6. ASR on non-native speech

**Evidence:**
- **Bohus & Rudnicky (2005)** (VERIFIED): WER 39.5% for non-native vs 19.6% for native users in the same system. Non-understandings were 25.2% vs 13.4%. Task success was 44.1% vs 85.2%.
- **Graham & Roll (2024)**, *JASA Express Letters* (VERIFIED abstract):
  - Whisper is more accurate on native than non-native accents.
  - WER is associated with L1 typology and L2 proficiency.
  - It does worse on conversational than read speech.
- **Svarah (Javed et al., Interspeech 2023)** (REPORTED): 9.6 h, 117 Indian speakers, read and spontaneous English. There is a clear gap on Indian accents across 6 open-source and 2 commercial systems. Later vendor-reported Svarah WERs of about 6–10% are not comparable and are unverified.
- **Errors can be masked:** ASR LMs "fix" learner grammar (Kumar et al. 2023, above). **Low-WER systems may hide more learner errors** (REPORTED; a 2026 BEA paper on "intent bias", unverified).

**Strategies (PRACTITIONER / ASSUMPTION, grounded in the above):**

1. **Never correct a token whose ASR word confidence is below a threshold.** Calibrate the threshold per language and engine on in-house data. Also skip any token adjacent to a low-confidence token.
2. **"ASR-fragile" error categories need extra evidence.** These are small or unstressed function morphemes that ASR may drop, insert or normalise:
   - **Japanese:** particles は/が/を/に/で/へ/も; long vowels; っ (geminates); ん; verb endings (〜ます/〜ました, て-form).
   - **German:** article and adjective endings (-e/-en/-er/-em/-es), der/den/dem, schwa endings.
   - **English:** articles a/the, plural and 3sg -s, past -ed, contractions.

   Only flag these if all three hold:
   - (a) ASR confidence is high on the token and its neighbours.
   - (b) An independent check agrees, such as N-best/alternate decode or a second ASR pass.
   - (c) The error is grammatically certain, not a plausible mishearing.

   Otherwise do not correct. At most, model the correct form naturally in the tutor's reply.
3. **Disfluencies are not errors.** Remove fillers, repetitions and self-repairs before GEC. Credit self-repairs as positive evidence.
4. **When the meaning is uncertain, confirm.** For example: "Did you mean …?" with a partial echo.
5. **Language ID:** Classify English/Hindi spans (code-switching) before GEC, so they are routed as help requests rather than "errors".
6. **Build an evaluation set:** Indian-accented learner speech per target language, human transcripts and human-validated corrections. Measure end-to-end card precision.

---

## 7. Uncertainty, clarification and recovery in dialogue

### 7.1 Bohus & Rudnicky (2005), SIGdial (VERIFIED full text)

**Setting:** 46 users, 449 sessions, 10 non-understanding recovery strategies chosen at random (control) vs by a wizard.

**Recovery rates (control):**

| Strategy | Recovery rate |
|---|---|
| **MoveOn** | **64.4%** |
| **FullHelp** | **58.5%** |
| **TerseYouCanSay** | **56.5%** |
| Reprompt | 49.2% |
| YouCanSay | 48.6% |
| AskRephrase | 48.6% |
| DetailedReprompt | 37.7% |
| Notify | 35.7% |
| **AskRepeat** | **33.7%** |
| **Yield** (silence) | **31.2%** |

**Other findings:**
- Errors spiral. After one error, the next turn is more likely to fail, as patience drops and mismatches grow.
- Switching plan (MoveOn) or giving sample responses breaks the spiral.
- AskRepeat improved to **53.0%** when a wizard used it *selectively*. Repeat requests work when the cause is transient (noise), not when the utterance is out of scope.
- Non-understandings matter: when they exceed about 10% of turns, task success drops fast (10%→30% non-understandings cut predicted success from 90% to 52%).
- **Misunderstandings cost about 2.24× non-understandings.** Acting on a wrong interpretation is worse than admitting non-understanding. This directly supports "never pretend to understand".
- The wizard policy's gains were concentrated in **non-native users** (task success 31.6% → 57.4%).
- About 40% of rejections were *false* rejections (correctly understood, but confidence too low). Threshold tuning matters.

### 7.2 LLMs and clarification (REPORTED)

LLMs ask clarification questions in patterns that differ from humans' (Madge, Purver & Poesio, CRAC 2025). Clarification behaviour should be **explicitly controlled by the dialogue manager**, not left to free generation.

### 7.3 Recommended recovery architecture (ASSUMPTION, grounded in 7.1, 5.3, 6)

1. **Deterministic state machine** for retry counts, silence timers, hint ladder and strictness. These are never left to the LLM.
2. **Structured turn classifier.** The LLM gets a constrained enum output plus ASR features. Classes:
   - `understood`
   - `partially_understood` (with the recovered fragment)
   - `not_understood`
   - `off_topic`
   - `native_language_help` (English/Hindi or another L1, a help request)
   - `meta_request` (repeat / slower / meaning of word / "I don't know")
   - `silence`
   - `empty_or_noise_audio`
3. **Classification reliability:** Use N=3 samples or two prompts and require agreement for `understood`. Fall back to `partially_understood` on disagreement.
4. **Confidence-based routing:**
   - Low mean ASR confidence or a disagreeing classifier → do not correct, do not assert understanding.
   - High confidence → normal turn.
5. **Recovery ladder** (replaces "repeat ×2"):
   1. **Attempt 1:** If partial: "I heard '…' — could you say the rest?" If nothing: ask the learner to **rephrase or say it more simply**, with a shorter version of the question.
   2. **Attempt 2:** **TerseYouCanSay**: "You can say: '…' or '…'". Show it on screen and play it on tap.
   3. **Then MoveOn:** Ask a simpler or different question on the same topic. Log the event. Never mark it as a learner error.
6. **Session-level budget:** If non-understandings exceed about 15% of the last 10 turns, switch to simpler questions, slower TTS and pre-emptive "You can say" chips. Bohus & Rudnicky propose pre-emptive you-can-say for non-native users.
7. **Dialogue state:** Track topic, the current question, the learner's last valid content, pending corrections (≤1 recast queued), hint level and retry count. Persist error-type counts per session for the summary and the level update.

---

## 8. Proficiency estimation with LLMs, and the update rule

### 8.1 LLM rating agreement

- **Yancey et al. (2023)**, BEA (VERIFIED abstract): GPT-4 rated short L2 English essays on CEFR. **With calibration examples it performed "almost as well as" modern AWE**, but **agreement varied by test-taker L1**. This is a fairness risk for Indian L1s.
- **Bannò, Vydana, Knill & Gales (2024)**, BEA (REPORTED): zero-shot GPT-4 analytic scoring of written essays correlated significantly with proficiency-component features.
- **Bannò et al. (2025)**, arXiv 2507.10200 (REPORTED): text-only zero-shot LLM (Qwen2.5-72B) with **can-do descriptors** on Speak & Improve transcripts. It beat a BERT model trained for the task but **did not match fine-tuned speech LLMs**.
- **Ma et al. (Interspeech 2025)** (REPORTED): speech LLMs outperform previous baselines for L2 oral proficiency.
- **Run-to-run variance** (REPORTED, 2025–2026 preprints): temperature 0 does not guarantee determinism. Scores drift across runs and model versions. Pin model versions, sample several times, and use the median.

### 8.2 What the logs can measure, by reliability

| Signal | Reliability from a 5-min session | Notes |
|---|---|---|
| Learner speaking time; turns; words per turn (mean length of utterance) | Good | Japanese needs a morphological tokenizer (characters or morphemes), so it is not comparable across languages. Compare within the learner only. |
| Speech rate, pauses, mean length of run | Moderate | Classic fluency measures (Kormos & Dénes 2004, *System* 32(2), REPORTED). Tap-to-talk timing confounds latency. Use speech-internal pauses, not time-to-tap. |
| Hint level used, retries, "You can say" uses, English/Hindi help requests | Good | Direct dynamic-assessment-style signals (§3). |
| Try-again repair success | Good | Prompt-based self-repair rate. |
| Lexical diversity | Weak per session | Use **MTLD** (length-robust per McCarthy & Jarvis 2010, VERIFIED abstract). Aggregate across sessions, because 5-min samples are short. |
| Errors per 100 words | Weak; a *lower bound* | ASR masks errors (§6). Only count high-precision, gated errors. Show as an estimate. |
| LLM holistic CEFR rating of transcript | Noisy | Median of ≥3 samples, fixed rubric of can-do descriptors, pinned model. Weight it modestly. |

### 8.3 Recommended update rule (ASSUMPTION; Elo-family rationale from Pelánek 2016)

Pelánek (2016), *Computers & Education* (REPORTED abstract), argues Elo-style updating is **simple, robust and effective** for adaptive educational systems.

**Proposal: a per-skill continuous score with shrinking step size and hysteresis.**

- **Scale:** Each skill s ∈ {grammar, vocabulary, fluency, comprehension} has a continuous score θ_s on a 0–6 scale (A1 = 1 … C2 = 6). Initialise it from the onboarding can-do responses.
- **Per-session evidence:** x_s is a weighted combination of normalised log signals and the LLM median rating, mapped to the same scale.
- **Update:** θ_s ← θ_s + k_n · (x_s − θ_s), with k_n = max(0.15, 1/(n+1.5)) after session n. The first session moves the estimate a lot; later sessions move it little.
  - Cap the change per session at ±0.5 level.
  - Skip the update for sessions shorter than about 60 s of learner speech, or with a non-understanding rate above 30% (bad audio).
- **Displayed band:** Use hysteresis. Change the displayed level only when θ_s has been beyond the band boundary by ≥0.2 for **2 consecutive sessions**.
- **Uncertainty:** Keep a simple uncertainty value (for example, the variance of the last 5 x_s values). Show it as a range.

**What to show users:**
- "Estimated level: **A2** (likely between A2 and B1) · based on your last 5 sessions."
- A per-skill bar, with the word "estimate".
- A tooltip: "We estimate from how you speak in sessions. It's not an exam result."
- A link to "What A2 means" (can-do statements).
- **Never show** a raw error rate as a grade.
- **Do show** progress signals such as "needed fewer hints than last week".

---

## 9. Common error patterns to seed the taxonomy

**Severity:**
- H = impedes meaning or is highly recurrent and level-appropriate
- M = noticeable, but meaning is clear
- L = minor or stylistic

**ASR-fragile:** see §6.

### 9.1 English (Indian/South Asian learners)

| Category | Example | Treatment | Source |
|---|---|---|---|
| Stative verbs in progressive | "I am having two brothers", "We are knowing each other" | **Valid Indian English** (eWAVE codes it as pervasive). Do not mark as an error. Strict mode may show an optional "In US/UK English people usually say…" tip. | eWAVE (REPORTED) |
| Invariant tag "isn't it?" | "You're coming tomorrow, isn't it?" | Valid Indian English. At most an optional tip. | SJSU guide; Gargesh & Sailaja (REPORTED) |
| Articles (omission/insertion) | "I went to market", "He is doctor" | Indian English article use is systematic: L1 transfer plus discourse-based retention (Sharma 2005). **Article errors are ASR-fragile.** Flag only with high confidence; Balanced = M, Relaxed = summary only. | Sharma 2005, *SSLA* 27(4) (REPORTED abstract) |
| Prepositions | "discuss about", "married with" | Some are established Indian English usages. Severity L–M. | PRACTITIONER |
| Tense and aspect | "I have gone there yesterday" | M; recurrent. | PRACTITIONER |
| Question formation | "Where you are going?", "What he said?" | M at A2–B1 (developmental). | PRACTITIONER |
| 3sg -s, plural -s | "He go", "two book" | ASR-fragile. | PRACTITIONER |
| Lexical "Indianisms" | "prepone", "do the needful", "cousin-brother" | Valid variety. Never an error; optional international-English tip. | PRACTITIONER |

### 9.2 Japanese learners

**Note:** I found no strong peer-reviewed frequency data for Hindi/Tamil/Bengali-L1 learners of Japanese. Rows are mostly PRACTITIONER knowledge informed by general JSL error research.

| Category | Example | Treatment | Source |
|---|---|---|---|
| は vs が | 私が学生です (in a neutral self-introduction) | Often context-dependent and both can be acceptable. Low confidence → **rarely correct**. Only clear cases (e.g., が in existential あります clauses at A1–A2). | PRACTITIONER |
| を/に/で/へ confusion | 図書館に勉強します → で | H at A1–A2. **ASR-fragile** (short particles). | Particle errors are a large share of JSL grammatical errors (APU detection study, REPORTED). Particle omission is the most frequent error type in one learner corpus (NAIST thesis, REPORTED). |
| Particle omission | 私 学生です | Casual speech legitimately drops particles. Correct only in polite register and only with high ASR confidence. | PRACTITIONER |
| Politeness/register mixing | です/ます and plain forms mixed within one utterance | Native speakers style-shift meaningfully (Cook; Taguchi, REPORTED), so mixing is not always an error. Flag only clear inconsistency, L–M. | REPORTED + PRACTITIONER |
| Verb forms | て-form errors (かいて/かって), ます-stem, past/negative | H at A1–A2. | PRACTITIONER |
| Counters | りんごが三人 | M; listen for ASR mishearing. | PRACTITIONER |
| Long vowels / っ / ん | おばさん vs おばあさん, きて vs きって | **Pronunciation, not grammar.** No pronunciation scoring in MVP, so do **not** turn these into grammar cards. They are also highly ASR-fragile. | PRACTITIONER |
| Adjective conjugation | おいしいでした → おいしかったです | H at A2. | PRACTITIONER |

### 9.3 German learners

| Category | Example | Treatment | Source |
|---|---|---|---|
| Gender/article | die Tisch | M. Gender errors stem from lexical learning, form–meaning mapping and processing pressure. Gender is fused with case and number. | IRAL 2008 study (REPORTED) |
| Case after prepositions / verbs | mit der Mann, ich helfe dich | M–H at A2–B1. **ASR-fragile endings.** | PRACTITIONER |
| Adjective endings | ein gute Freund | L–M (B1+). ASR-fragile. Strict mode only below B1. | PRACTITIONER |
| V2 / inversion | Heute ich gehe ins Kino | H. Follows a developmental sequence (ZISA / Processability Theory): SVO → adverb fronting → verb separation → inversion → verb-final. Correct it once learners are ready (~A2+). | Clahsen, Meisel & Pienemann 1983; Pienemann 1998 (REPORTED; secondary sources disagree on the order of separation vs inversion) |
| Verb-final in subordinate clauses | …, weil ich habe keine Zeit | M; acquired last. At B1+, note that colloquial *weil* + V2 exists in spoken German, so B1 tutors should treat it as L. | PRACTITIONER |
| Separable verbs | Ich anrufe dich | M–H. | ZISA sequence (REPORTED) |
| du/Sie inconsistency | mixing du and Sie with the same addressee | M (pragmatic). | PRACTITIONER |
| Perfekt auxiliary | Ich habe gegangen | H at A2. | PRACTITIONER |

**Taxonomy design:**
- Use ERRANT-style operation × category codes (Bryant et al. 2017, REPORTED) for English.
- Use language-specific categories for German and Japanese.
- Each category carries: severity by level, ASR-fragile flag, "valid-variety" flag, a rule template for the card, and the minimum level at which to correct.
- Avoid correcting structures beyond the learner's developmental readiness. The Processability/Teachability argument (REPORTED) says instruction cannot skip stages.

---

## 10. Cultural and pragmatic norms the tutor should model

### Japanese (PRACTITIONER + REPORTED)
- The tutor speaks **です/ます** by default at A1–A2. This is standard in mainstream beginner curricula; I did not verify specific textbook sequencing.
- Introduce plain/casual forms at about A2+/B1, or when the learner picks a "chat with a friend" scenario. Signal the register switch explicitly ("Let's talk casually now").
- Research on style shift (Cook; Taguchi) shows です/ます and plain forms index identity and stance, not just politeness. Learners abroad report that です/ます can feel distant.
- **Do not penalise** plain form in a casual scenario. **Do not** treat every shift as an error.
- Avoid keigo (honorific/humble) correction before B1+ unless the scenario calls for it (e.g., a job interview).

### German (PRACTITIONER + REPORTED)
Address practices vary by context and are changing (Clyne, Norrby & Warren 2009, CUP, REPORTED).
- **Recommendation:** The cartoon tutor uses **du** for free conversation, a friendly peer persona (an assumption to validate with users).
- **Sie** is taught and used in service, work and formal scenarios.
- Flag only *inconsistency* toward the same addressee, or du in a clearly formal scenario (Balanced+).

### English for Indian learners
- **Indian English is an established, norm-developing variety** in Kachru's Outer Circle (REPORTED, secondary).
- Pedagogical arguments favour treating its features as **differences, not errors** (REPORTED).
- **LLM risk (Fleisig et al. 2024, EMNLP, VERIFIED abstract):** GPT-3.5/4 default to "standard" US/UK English. Responses to non-standard varieties showed more stereotyping (+19%), demeaning content (+25%), lack of comprehension (+9%) and condescension (+15%). I did not confirm whether Indian English was among the 10 varieties studied.
- **Product rules:**
  - The default target is "clear international English". Indian English features on the allowlist are never errors.
  - A learner-selectable "target style: Indian / British / American / exam" setting can turn variety differences into optional **tips** (never errors).
  - Test prompts for condescension.

---

## 11. Spaced repetition (post-MVP)

- **FSRS** (Free Spaced Repetition Scheduler): models retrievability, stability and difficulty, and fits parameters from review history. It is in **Anki since 23.10** as an alternative to Anki's SM-2-based default (VERIFIED, Anki FAQ). The FAQ makes only qualitative efficiency claims. "Preliminary tests" put it roughly on par with SM-17.
- **Open benchmark** (`open-spaced-repetition/srs-benchmark`, VERIFIED README):
  - About 10k Anki users; about 350M (without same-day) or 519M (with same-day) reviews evaluated.
  - FSRS-7 log loss 0.337 vs FSRS v4 0.373 vs average baseline 0.395 (without same-day).
  - The README text did not show SM-2 rows.
- An Anki-forum post quoting the benchmark says **FSRS-5 beats trainable SM-2 for 97.4% of users** (REPORTED). The often-quoted "99.6%" figure is unverified.
- **ts-fsrs:** TypeScript, **MIT licence**, FSRS-v6 badge (VERIFIED, GitHub). It includes a binding package to train parameters from review logs.
- **Recommendation:** Post-MVP, turn accepted correction cards and new vocabulary into review items scheduled with ts-fsrs, defaulting to desired retention of about 0.9. Spoken review ("say it again") counts as a review grade.

---

## 12. Design implications (concrete product rules)

### 12.1 Correction pipeline (precision-first)

1. **Stage A – Normalise:** Run ASR to get word confidences. Remove disfluencies. Tag language spans (English/Hindi help vs target language).
2. **Stage B – Detect:** Use a minimal-edit prompt with an **explicit error-type taxonomy** (§9), instructing the model to return *atomic edits only*. Sample **k = 3–5** candidates, or two different prompts/models.
3. **Stage C – Gate.** Keep an edit only if **all** of these hold:
   - It appears in ≥ majority of samples (edit-level voting, per Goto et al. 2026).
   - All tokens in its span, plus one neighbour on each side, have ASR confidence ≥ τ_lang.
   - It is not an allowlisted variety feature (Indian English list) or legitimate register variation.
   - It is not purely stylistic. Stylistic suggestions are routed to "tips" and never counted as errors.
   - It maps to a taxonomy category with a rule reference (the card's explanation must cite a rule).
   - If it is ASR-fragile, an extra independent check agrees (alternate decode).
   - Never use the LLM's verbalised confidence as a gate.
4. **Stage D – Explain:** Make a separate call per kept atomic edit. Output a one-sentence rule plus an example (GEE pattern). Validate the output against the taxonomy (category must match).
5. **Stage E – Prioritise:** Score = severity(level) × recurrence (this learner, last 3 sessions) × level-appropriateness.
   - The top 1 edit is eligible for a **spoken recast**, but only if it was gated on the fast path *before* TTS starts.
   - Next edits become cards.
   - The rest go to the summary.
6. **Latency split (ASSUMPTION):** The spoken reply cannot wait for the full verification pipeline. Allow the recast only for high-confidence, common categories decided by a fast first pass. Cards may arrive 1–2 s later after full gating.
7. **Measure:**
   - Card precision on an internal, human-labelled set per language, including Indian-accented audio.
   - **Launch target ≥95% precision** (ASSUMPTION; set by product), with recall secondary.
   - Add a "This correction is wrong" button. Track the flag rate per category, and auto-disable categories whose flag rate exceeds a threshold.

### 12.2 Strictness levels (precision gate identical at all levels)

| | Relaxed | Balanced (default) | Strict |
|---|---|---|---|
| Spoken recast | Only H-severity and recurrent errors; ≤1 every other turn | ≤1 per turn (H/M) | ≤1 per turn (H/M) |
| Cards shown live | ≤1 per turn, H only | ≤2 per turn, H/M | All gated errors, including L (articles, endings, adjective endings) |
| "Try again" | Optional | Offered on cards | Offered by default, before the answer is revealed |
| Style or variety tips | Off | Off | On (labelled "tip", not "mistake") |
| End summary | Top 3 patterns | Top 5 patterns + all cards | Everything + suggested practice |

Strict means *more categories surfaced*, **not lower thresholds**. This protects the "trustworthy corrections" differentiator.

### 12.3 Hint ladder and silence

**Ladder:**

| Step | Content |
|---|---|
| 0 | Hint button pulses (~10 s); nothing revealed |
| 1 | Contextual hint: a keyword or a gloss of the question |
| 2 | Sentence starter |
| 3 | Full example to repeat or adapt |

- At about 25 s, the tutor gives a spoken nudge that **offers** step 1. It does not jump to the answer.
- Log the max step per turn, giving an independence score (§3.3). Celebrate reduced reliance per structure.
- The thresholds (10 s / 25 s) are untested assumptions. Make them configurable by level, perhaps longer at A1, and A/B test.

### 12.4 Unclear speech (revised from "repeat ×2")

| Situation | Response |
|---|---|
| `partially_understood` | Echo the fragment and ask for the rest, or confirm ("Did you mean …?"). |
| `not_understood`, attempt 1 | Ask to rephrase or say it more simply, giving a shorter version of the question. |
| `not_understood`, attempt 2 | "You can say: '…' / '…'" (2 options, tappable audio). |
| Then | **MoveOn**: a simpler or different question on the same topic. No error is logged against the learner. |
| Rolling non-understanding rate >15% | Simplify: slower TTS, closed questions, pre-emptive "You can say" chips. |
| Always | Never correct anything from a turn classed below `understood`. |

### 12.5 Turn classification

- **Classes:** `understood`, `partially_understood`, `not_understood`, `off_topic`, `native_language_help`, `meta_request`, `silence`, `empty_or_noise_audio`.
- **Mechanics:** Use LLM constrained output (enum + extracted fragment) plus ASR features. Require agreement of ≥2 of 3 samples for `understood`.
- **Rules live in code:** Deterministic code owns counters, timers and transitions. The LLM classifies and generates; it never decides retry policy.
- **`native_language_help`:** Answer the help request briefly in English text on screen. Give the target-language phrase. Invite the learner to try it. No error is logged.

### 12.6 Talk ratio and turns

- Follow the turn-length and question-type table in §2.4.
- End every tutor turn with exactly one question.
- Track learner speaking-time share. Target ≥50% from A2, as an internal metric.

### 12.7 Level estimate

- **Onboarding:** 8–12 concrete can-do items per skill (paraphrased from CEFR / JF Standard). This produces an initial θ with a wide range.
- **Updates:** Per-skill score with step size k_n = max(0.15, 1/(n+1.5)), ±0.5 cap per session, and displayed-band hysteresis (≥0.2 beyond the boundary for 2 consecutive sessions).
- **Inputs:** Fluency (speech rate and mean run length), mean length of utterance, MTLD (aggregated), gated error rate (a lower bound), hint independence, Try-again repair rate, and the LLM can-do rating (median of 3, pinned model).
- **Display:** "Estimate", with a band and the session count. Never present it as a certificate. Never map JLPT or Goethe certificates to *speaking* without evidence.

### 12.8 Error taxonomy

Seed it from §9. Each category stores:
- id, language
- description
- severity by level
- minimum level to correct
- ASR-fragile flag
- valid-variety / register flag
- card rule template (≤15 words)
- example pair

Review it with a native-speaker teacher per language before launch. **The Indian English allowlist is mandatory.**

### 12.9 Open evidence gaps (recommend in-house studies)

1. LLM GEC precision on **spoken Japanese learner** transcripts. No public benchmark found.
2. ASR WER and confidence calibration for **Indian-L1 speakers of Japanese and German**. No public data found.
3. Optimal silence thresholds and recast frequency for voice tutors. No direct studies found.
4. Whether Indian adult learners prefer Balanced or Strict by default. Run a quick preference test.

---

## Sources

All accessed 2026-10-14. The label shows how each was used in these notes.

### Corrective feedback and SLA

- Aljaafreh, A., & Lantolf, J. P. (1994). Negative feedback as regulation and second language learning in the zone of proximal development. *The Modern Language Journal, 78*(4), 465–483. https://doi.org/10.1111/j.1540-4781.1994.tb02064.x (PDF read: https://files.cercomp.ufg.br/weby/up/1752/o/Negative_Feedback_as_Regulation_and_Seco.pdf). **VERIFIED**
- Bao, R., & Wang, H. (2023). A comparison between the preferences for oral corrective feedback of teachers and students of Chinese as a second language. *Frontiers in Psychology, 14*. https://doi.org/10.3389/fpsyg.2023.1112136. **VERIFIED**
- Brock, C. A. (1986). The effects of referential questions on ESL classroom discourse. *TESOL Quarterly, 20*(1), 47–59. https://doi.org/10.2307/3586388. **REPORTED**
- Ellis, R., Loewen, S., & Erlam, R. (2006). Implicit and explicit corrective feedback and the acquisition of L2 grammar. *Studies in Second Language Acquisition, 28*(2), 339–368. https://www.cambridge.org/core/product/CDE67D4A4E286921DA4BE9C40BAD9FE6. **REPORTED**
- Fu, M., & Li, S. (2022). The effects of immediate and delayed corrective feedback on L2 development. *SSLA, 44*(1), 2–34. https://doi.org/10.1017/S0272263120000388. **REPORTED (citation only)**
- Krashen, S. (1985). *The Input Hypothesis: Issues and Implications.* Longman. **REPORTED (standard citation)**
- Li, S. (2010). The effectiveness of corrective feedback in SLA: A meta-analysis. *Language Learning, 60*(2), 309–365. https://researchspace.auckland.ac.nz/handle/2292/24985. **REPORTED**
- Li, S., Zhu, Y., & Ellis, R. (2016). The effects of the timing of corrective feedback on the acquisition of a new linguistic structure. *The Modern Language Journal, 100*, 276–295. https://research.polyu.edu.hk/en/publications/the-effects-of-the-timing-of-corrective-feedback-on-the-acquisiti/. **REPORTED**
- Long, M. H. (1996). The role of the linguistic environment in second language acquisition. In W. C. Ritchie & T. K. Bhatia (Eds.), *Handbook of Second Language Acquisition*. Academic Press. **REPORTED (standard citation)**
- Lyster, R., & Ranta, L. (1997). Corrective feedback and learner uptake. *SSLA, 19*, 37–66. Figures taken from Tedick, D. J., & de Gortari, B. (1998). Research on error correction and implications for classroom teaching. *ACIE Newsletter, 1*(3), CARLA, University of Minnesota. https://archive.carla.umn.edu/immersion/acie/vol1/May1998.pdf. **REPORTED (detailed secondary; read)**
- Lyster, R., & Saito, K. (2010). Oral feedback in classroom SLA: A meta-analysis. *SSLA, 32*(2), 265–302. https://doi.org/10.1017/S0272263109990520. **VERIFIED (abstract)**
- Lyster, R., Saito, K., & Sato, M. (2013). Oral corrective feedback in second language classrooms. *Language Teaching, 46*(1), 1–40. https://www.cambridge.org/core/journals/language-teaching/article/abs/oral-corrective-feedback-in-second-language-classrooms/B33FC71C12A1317DCA0CE704B7B0BC00. **REPORTED (abstract)**
- Mackey, A., & Goo, J. (2007). Interaction research in SLA: A meta-analysis and research synthesis. In A. Mackey (Ed.), *Conversational Interaction in Second Language Acquisition*. OUP. **REPORTED (figures via Lyster & Saito 2010)**
- Poehner, M. E., & Lantolf, J. P. Computerized dynamic assessment, as summarised by CALPER (Penn State): https://sites.psu.edu/calperlanguageassessment/assessment-approaches/dynamic-assessment. **REPORTED**
- Rowe, M. B. (1986). Wait time: Slowing down may be a way of speeding up! *Journal of Teacher Education, 37*(1), 43–50. https://doi.org/10.1177/002248718603700110. **REPORTED**
- Russell, J., & Spada, N. (2006). The effectiveness of corrective feedback for the acquisition of L2 grammar: A meta-analysis. In J. Norris & L. Ortega (Eds.), *Synthesizing Research on Language Learning and Teaching*. John Benjamins. **REPORTED**
- Sheen, Y. (2006). Exploring the relationship between characteristics of recasts and learner uptake. *Language Teaching Research, 10*(4), 361–392. https://doi.org/10.1191/1362168806lr203oa. **REPORTED**
- Stivers, T., et al. (2009). Universals and cultural variation in turn-taking in conversation. *PNAS, 106*(26), 10587–10592. https://doi.org/10.1073/pnas.0903616106. **REPORTED (abstract)**
- Swain, M. (1985). Communicative competence: Some roles of comprehensible input and comprehensible output in its development. In S. Gass & C. Madden (Eds.), *Input in Second Language Acquisition*. Newbury House. Also Swain (1995), Three functions of output. **REPORTED (standard citations)**

### Levels, frameworks and assessment

- Council of Europe / Europass. *Common European Framework of Reference for Languages: Self-assessment grid* (© European Union and Council of Europe, 2004–2020). https://europass.europa.eu/system/files/2020-05/CEFR%20self-assessment%20grid%20EN.pdf. **VERIFIED**
- Council of Europe. (2020). *CEFR Companion Volume.* https://rm.coe.int/common-european-framework-of-reference-for-languages-learning-teaching/16809ea0d4. **Not accessible (403); not quoted**
- Council of Europe. Copyright, licensing and permissions. https://www.coe.int/en/web/portal/copyright-licensing-permissions. **REPORTED (via search)**
- Japan Foundation & JEES. CEFR reference levels for the JLPT. https://www.jlpt.jp/e/about/cefr_reference.html. **VERIFIED**
- Japan Foundation. What is the JF Standard for Japanese-Language Education? https://www.kyozai.jpf.go.jp/kyozai/help/about/jfscando/en/render.do. **VERIFIED**
- Goethe-Institut exam information pages, e.g., https://www.goethe.de/ins/hon/en/spr/exams/a1f/wei.html. **REPORTED**
- Li, M., & Zhang, X. (2021). A meta-analysis of self-assessment and language performance in language testing and assessment. *Language Testing, 38*(2), 189–218. https://sage.figshare.com/collections/A_meta-analysis_of_self-assessment_and_language_performance_in_language_testing_and_assessment/5021492. **REPORTED**
- Milton, J., & Alexiou, T. (2010). Developing a vocabulary size test in Greek as a foreign language. *GALA Selected Papers*, 307–318 (Table 2 reproduces Milton & Alexiou 2009, Palgrave). https://www.enl.auth.gr/gala/14th/Papers/English%20papers/Milton&Alexiou.pdf. **VERIFIED**
- Ross, S. (1998). Self-assessment in second language testing: A meta-analysis and analysis of experiential factors. *Language Testing, 15*(1). **REPORTED (figures via secondary)**
- Yancey, K. P., LaFlair, G. T., Verardi, A. R., & Burstein, J. (2023). Rating short L2 essays on the CEFR scale with GPT-4. *BEA 2023*, 576–584. https://doi.org/10.18653/v1/2023.bea-1.49. **VERIFIED (abstract)**
- Bannò, S., Vydana, H. K., Knill, K. M., & Gales, M. J. F. (2024). Can GPT-4 do L2 analytic assessment? *BEA 2024*, 149–164. https://aclanthology.org/2024.bea-1.14. **REPORTED**
- Bannò, S., et al. (2025). Natural language-based assessment of L2 oral proficiency using LLMs. arXiv:2507.10200. **REPORTED**
- Ma, R., et al. (2025). Assessment of L2 oral proficiency using speech large language models. *Interspeech 2025*. https://www.isca-archive.org/interspeech_2025/ma25b_interspeech.html. **REPORTED**
- Pelánek, R. (2016). Applications of the Elo rating system in adaptive educational systems. *Computers & Education*. https://doi.org/10.1016/j.compedu.2016.03.017. **REPORTED (abstract)**
- McCarthy, P. M., & Jarvis, S. (2010). MTLD, vocd-D, and HD-D. *Behavior Research Methods, 42*(2), 381–392. https://doi.org/10.3758/BRM.42.2.381. **REPORTED (abstract)**
- Kormos, J., & Dénes, M. (2004). Exploring measures and perceptions of fluency in the speech of second language learners. *System, 32*(2), 145–164. https://doi.org/10.1016/j.system.2004.01.001. **REPORTED**
- LLM-judge variance preprints: arXiv:2503.09347; arXiv:2603.04417; arXiv:2606.26185. **REPORTED (preprints)**

### GEC, ASR and dialogue reliability

- Coyne, S., Sakaguchi, K., Galvan-Sosa, D., Zock, M., & Inui, K. (2023). Analyzing the performance of GPT-3.5 and GPT-4 in grammatical error correction. arXiv:2303.14342. https://arxiv.org/abs/2303.14342. **VERIFIED (abstract)**
- Fang, T., et al. (2023). Is ChatGPT a highly fluent grammatical error correction system? A comprehensive evaluation. arXiv:2304.01746. **REPORTED**
- Loem, M., Kaneko, M., Takase, S., & Okazaki, N. (2023). Exploring effectiveness of GPT-3 in grammatical error correction. *BEA 2023*, 205–219. https://aclanthology.org/2023.bea-1.18. **REPORTED**
- Davis, C., et al. (2024). Prompting open-source and commercial language models for grammatical error correction of English learner text. *Findings of ACL 2024*. https://arxiv.org/abs/2401.07702. **VERIFIED (abstract)**
- Goto, T., Sakai, Y., & Watanabe, T. (2026). Edit-level majority voting mitigates over-correction in LLM-based grammatical error correction. *BEA 2026*. https://arxiv.org/abs/2605.13624. **VERIFIED (abstract)**
- Karpo, K., & Chernodub, A. (2026). Larger context window, fewer overcorrections. *Findings of EMNLP 2026*. https://arxiv.org/abs/2609.10810. **VERIFIED (abstract)**
- Song, Y., Krishna, K., Bhatt, R., Gimpel, K., & Iyyer, M. (2024). GEE! Grammar error explanation with large language models. *Findings of NAACL 2024*. https://arxiv.org/abs/2311.09517. **VERIFIED (abstract)**
- Encode Errors: Representational retrieval of in-context demonstrations for multilingual GEC. arXiv:2606.15416. **REPORTED**
- Koyama, A., et al. (2020). Construction of an evaluation corpus for grammatical error correction for learners of Japanese as a second language. *LREC 2020*. https://aclanthology.org/2020.lrec-1.26. **REPORTED**
- Wang & Yuan (2024). Assessing the efficacy of grammar error correction: A human evaluation approach in the Japanese context. arXiv:2402.18101. **REPORTED**
- Bryant, C., Felice, M., & Briscoe, T. (2017). Automatic annotation and evaluation of error types for grammatical error correction (ERRANT). *ACL 2017*. **REPORTED (standard citation)**
- Qian, M., Ma, R., Bannò, S., Gales, M. J. F., & Knill, K. M. (2025). End-to-end spoken grammatical error correction. arXiv:2506.18532. **VERIFIED (abstract)**
- Qian, M., Knill, K., Bannò, S., et al. (2024). Speak & Improve Challenge 2025: Tasks and baseline systems. arXiv:2412.11985. Also Knill, K., et al. (2024). Speak & Improve Corpus 2025. arXiv:2412.11986. **REPORTED**
- Kumar, C. V. T., Sirigiraju, M., Vaideeswaran, R., Ghosh, P. K., & Yarra, C. (2023). Can the decoded text from automatic speech recognition effectively detect spoken grammar errors? *SLaTE 2023*. https://www.isca-archive.org/slate_2023/venkatathirumalakumar23_slate.html. **VERIFIED (abstract)**
- Kim, H., et al. (2024). LearnerVoice: A dataset of non-native English learners' spontaneous speech. *Interspeech 2024*. https://doi.org/10.21437/Interspeech.2024-2392. **VERIFIED (abstract)**
- Graham, C., & Roll, N. (2024). Evaluating OpenAI's Whisper ASR: Performance analysis across diverse accents and speaker traits. *JASA Express Letters*. https://doi.org/10.1121/10.0024876. **VERIFIED (abstract)**
- Javed, T., et al. (2023). Svarah: Evaluating English ASR systems on Indian accents. *Interspeech 2023*. https://arxiv.org/abs/2305.15760. **REPORTED**
- Bohus, D., & Rudnicky, A. I. (2005). Sorry, I didn't catch that! An investigation of non-understanding errors and recovery strategies. *6th SIGdial Workshop*, 128–143. https://aclanthology.org/2005.sigdial-1.14. **VERIFIED (full text)**
- Madge, Purver, & Poesio (2025). Referential ambiguity and clarification requests: Comparing human and LLM behaviour. *CRAC 2025*. https://aclanthology.org/2025.crac-1.1.pdf. **REPORTED**
- Xiong, M., et al. (2024). Can LLMs express their uncertainty? An empirical evaluation of confidence elicitation in LLMs. *ICLR 2024*. https://arxiv.org/abs/2306.13063. **REPORTED (abstract)**
- Huang, J., et al. (2024). Large language models cannot self-correct reasoning yet. *ICLR 2024*. https://arxiv.org/abs/2310.01798. **REPORTED (abstract)**

### Error patterns, varieties and pragmatics

- Sharma, D. (2005). Language transfer and discourse universals in Indian English article use. *SSLA, 27*(4), 535–566. https://doi.org/10.1017/S0272263105050242. **REPORTED (abstract)**
- eWAVE: Electronic World Atlas of Varieties of English, Indian English datapoints (e.g., progressive with stative verbs). https://ewave-atlas.org/. **REPORTED (via search snippet)**
- San José State University WAC. Guide: Indian-English variations. https://gcp-web.sjsu.edu/wac/docs/Guide%20Indian-English%20Variations.pdf. **REPORTED**
- Fleisig, E., et al. (2024). Linguistic bias in ChatGPT: Language models reinforce dialect discrimination. *EMNLP 2024*, 13541–13564. https://arxiv.org/abs/2406.08818. **VERIFIED (abstract)**
- Clahsen, H., Meisel, J., & Pienemann, M. (1983). *Deutsch als Zweitsprache.* Narr. Also Pienemann, M. (1998). *Language Processing and Second Language Development.* Benjamins. Stage summaries from https://msuweb.montclair.edu/~sotillos/stages-sequences.htm. **REPORTED**
- Diehl, E., et al. (2000). *Grammatikunterricht: Alles für der Katz?* Niemeyer (DiGS project). https://www.unige.ch/lettres/alman/de/recherche/abgeschlossene-projekte/digs. **REPORTED**
- L2 grammatical gender in a complex morphological system: The case of German. *IRAL* (2008). https://www.degruyterbrill.com/document/doi/10.1515/IRAL.2008.014/html. **REPORTED**
- Japanese style-shift research: Taguchi (2019) and Cook (masu as indexical), via https://emcawiki.net/Taguchi-Yoshimi2019. **REPORTED**
- JSL particle-error studies: NAIST thesis https://naist.repo.nii.ac.jp/record/10797/files/R012380.pdf; APU *Polyglossia* 18 (Oyama) https://secure.en.apu.ac.jp/rcaps/uploads/fckeditor/publications/polyglossia/Polyglossia_V18_Oyama.pdf. **REPORTED**
- Clyne, M., Norrby, C., & Warren, J. (2009). *Language and Human Relations: Styles of Address in Contemporary Language.* Cambridge University Press. **REPORTED**

### Spaced repetition

- Anki Manual FAQ: What spaced repetition algorithm does Anki use? https://docs.ankiweb.net/faqs/what-spaced-repetition-algorithm.md. **VERIFIED**
- open-spaced-repetition/srs-benchmark. https://github.com/open-spaced-repetition/srs-benchmark. **VERIFIED (README)**
- open-spaced-repetition/ts-fsrs (MIT). https://github.com/open-spaced-repetition/ts-fsrs. **VERIFIED**
- Anki forum discussion citing FSRS-5 vs SM-2 (97.4%). https://forums.ankiweb.net/t/has-anyone-done-a-live-comparison-of-fsrs-and-sm2-as-implemented-in-anki-it-looks-like-no-so-can-anyone-help-me-set-it-up/34996. **REPORTED**
