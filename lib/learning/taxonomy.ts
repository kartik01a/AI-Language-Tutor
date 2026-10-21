import type { Level } from "@/lib/tutor/corrections";

// Error taxonomy (docs/08 §3). Seeded from SLA research and practitioner knowledge; MUST be
// reviewed by a native-speaker teacher before the language goes live (docs/16 Phase 3).

export interface TaxonomyEntry {
  code: string;
  label: string;
  /** Severity at each level: 0 = never corrected at that level, 1 minor … 3 meaning-impeding. */
  severity: Record<Level, 0 | 1 | 2 | 3>;
  minLevel: Level;
  /** Short unstressed forms the recogniser may drop/insert/normalise (needs extra evidence). */
  asrFragile: boolean;
  /** Never an error (e.g. Indian English features). May surface as an optional tip only. */
  validVariety: boolean;
  /** Only an error in a particular register; the pipeline skips these when the register fits. */
  registerSensitive: boolean;
  /** Eligible for a spoken recast before full verification. */
  fastPathRecast: boolean;
  /** ≤ 15 words, shown on the card. */
  cardRule: string;
  example: { wrong: string; right: string };
}

const sev = (a: 0 | 1 | 2 | 3, b: 0 | 1 | 2 | 3, c: 0 | 1 | 2 | 3, d: 0 | 1 | 2 | 3): Record<Level, 0 | 1 | 2 | 3> => ({ A1: a, A2: b, B1: c, B2: d });

export const JA_TAXONOMY: TaxonomyEntry[] = [
  { code: "ja.particle.destination", label: "Particle for destination (に/へ)", severity: sev(3, 3, 2, 2), minLevel: "A1", asrFragile: true, validVariety: false, registerSensitive: false, fastPathRecast: true, cardRule: "Use に (or へ) after places you go to.", example: { wrong: "公園を行きました", right: "公園に行きました" } },
  { code: "ja.particle.location_action", label: "Particle for place of action (で)", severity: sev(3, 3, 2, 2), minLevel: "A1", asrFragile: true, validVariety: false, registerSensitive: false, fastPathRecast: true, cardRule: "Use で for the place where an action happens.", example: { wrong: "図書館に勉強します", right: "図書館で勉強します" } },
  { code: "ja.particle.object", label: "Object particle (を)", severity: sev(2, 2, 2, 1), minLevel: "A1", asrFragile: true, validVariety: false, registerSensitive: false, fastPathRecast: true, cardRule: "Use を after the thing you do something to.", example: { wrong: "水が飲みます", right: "水を飲みます" } },
  { code: "ja.particle.wa_ga", label: "は vs が", severity: sev(0, 1, 2, 2), minLevel: "A2", asrFragile: true, validVariety: false, registerSensitive: false, fastPathRecast: false, cardRule: "Use が to introduce new information, は for the topic.", example: { wrong: "あそこに犬は います", right: "あそこに犬がいます" } },
  { code: "ja.particle.omission", label: "Dropped particle", severity: sev(1, 1, 1, 1), minLevel: "A2", asrFragile: true, validVariety: false, registerSensitive: true, fastPathRecast: false, cardRule: "In polite speech, keep the particle (は、を、に…).", example: { wrong: "私 学生です", right: "私は学生です" } },
  { code: "ja.verb.te_form", label: "て-form", severity: sev(3, 3, 2, 2), minLevel: "A1", asrFragile: false, validVariety: false, registerSensitive: false, fastPathRecast: true, cardRule: "Check the て-form ending for this verb group.", example: { wrong: "かいて食べます", right: "買って食べます" } },
  { code: "ja.verb.tense", label: "Verb tense (past/non-past)", severity: sev(3, 3, 2, 2), minLevel: "A1", asrFragile: false, validVariety: false, registerSensitive: false, fastPathRecast: true, cardRule: "Past actions end in ～ました (polite past).", example: { wrong: "昨日、行きます", right: "昨日、行きました" } },
  { code: "ja.adj.i_past", label: "い-adjective past", severity: sev(0, 3, 2, 2), minLevel: "A2", asrFragile: false, validVariety: false, registerSensitive: false, fastPathRecast: true, cardRule: "い-adjectives: おいしい → おいしかったです.", example: { wrong: "おいしいでした", right: "おいしかったです" } },
  { code: "ja.counter", label: "Counters", severity: sev(2, 2, 2, 1), minLevel: "A1", asrFragile: true, validVariety: false, registerSensitive: false, fastPathRecast: false, cardRule: "Use the counter that matches the thing: 人 for people, つ for things.", example: { wrong: "りんごが三人", right: "りんごが三つ" } },
  { code: "ja.register.mixing", label: "Mixing polite and plain forms", severity: sev(0, 1, 2, 2), minLevel: "A2", asrFragile: false, validVariety: false, registerSensitive: true, fastPathRecast: false, cardRule: "Stay in one style within a sentence: です/ます or plain.", example: { wrong: "昨日は忙しかったです。行く。", right: "昨日は忙しかったです。行きません。" } },
  { code: "ja.vocab.word_choice", label: "Word choice", severity: sev(2, 2, 2, 2), minLevel: "A1", asrFragile: false, validVariety: false, registerSensitive: false, fastPathRecast: false, cardRule: "A more natural word here is shown below.", example: { wrong: "強いお茶", right: "濃いお茶" } },
];

const byCode = new Map(JA_TAXONOMY.map((t) => [t.code, t]));
export const taxonomyFor = (lang: "ja" | "de" | "en"): TaxonomyEntry[] => (lang === "ja" ? JA_TAXONOMY : []);
export const lookup = (code: string): TaxonomyEntry | undefined => byCode.get(code);
