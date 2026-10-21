// Automated avatar asset checks (docs/03 §B10). Runs on the SVG source string, so it works
// in Node (CI / build script) without a DOM.

export const MOUTH_IDS = [
  "mouth_rest", "mouth_mbp", "mouth_cons", "mouth_a", "mouth_i",
  "mouth_u", "mouth_e", "mouth_o", "mouth_fv", "mouth_l_th",
] as const;

const MVP_REQUIRED = [
  "rig", "body", "head", "head_base", "eyes",
  "eye_l", "eye_l_white", "eye_l_pupil", "eye_l_lid", "eye_l_closed",
  "eye_r", "eye_r_white", "eye_r_pupil", "eye_r_lid", "eye_r_closed",
  "brows", "brow_l", "brow_r", "mouth", ...MOUTH_IDS,
  "expr", "expr_neutral", "expr_happy", "expr_thinking", "expr_confused",
];
const PRODUCTION_EXTRA = ["expr_encouraging", "expr_celebrating", "cheeks", "shadow"];

/** Groups the controller animates: each must carry data-pivot="x y". */
export const ANIMATED_GROUPS = [
  "rig", "body", "head", "eye_l_pupil", "eye_r_pupil", "eye_l_lid", "eye_r_lid", "brow_l", "brow_r", "mouth",
];

export type Tier = "mvp" | "production";

export interface Budget {
  maxBytes: number;
  maxElements: number;
  maxPaths: number;
}
export const TARGET_BUDGET: Budget = { maxBytes: 60_000, maxElements: 250, maxPaths: 150 };
export const HARD_CAP: Budget = { maxBytes: 120_000, maxElements: 400, maxPaths: 250 };

export interface ContractIssue {
  level: "error" | "warning";
  rule: string;
  message: string;
}

const FORBIDDEN_TAGS = ["text", "image", "filter", "mask", "pattern", "foreignObject", "script", "style"];

export function validateAvatarSvg(svg: string, tier: Tier = "mvp"): ContractIssue[] {
  const issues: ContractIssue[] = [];
  const err = (rule: string, message: string) => issues.push({ level: "error", rule, message });
  const warn = (rule: string, message: string) => issues.push({ level: "warning", rule, message });

  const root = svg.match(/<svg\b[^>]*>/)?.[0] ?? "";
  if (!root) {
    err("root", "No <svg> root element");
    return issues;
  }
  if (!/viewBox="0 0 512 (512|640)"/.test(root)) err("root.viewBox", 'viewBox must be "0 0 512 512" or "0 0 512 640"');
  if (!/data-contract="1"/.test(root)) err("root.contract", 'Root needs data-contract="1"');
  if (/\s(width|height)=/.test(root)) err("root.size", "Root must not have width/height (size with CSS)");

  const ids = [...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const seen = new Set<string>();
  for (const id of ids) {
    if (!/^[a-z][a-z0-9_]*$/.test(id)) err("id.format", `Invalid id "${id}" (lowercase snake_case)`);
    if (seen.has(id)) err("id.unique", `Duplicate id "${id}"`);
    seen.add(id);
  }

  const required = tier === "production" ? [...MVP_REQUIRED, ...PRODUCTION_EXTRA] : MVP_REQUIRED;
  for (const id of required) if (!seen.has(id)) err("id.required", `Missing required id "${id}"`);

  for (const id of ANIMATED_GROUPS) {
    const tag = svg.match(new RegExp(`<[a-z]+[^>]*\\sid="${id}"[^>]*>`))?.[0];
    if (!tag) continue; // already reported as missing
    const pivot = tag.match(/data-pivot="([-\d.]+)\s+([-\d.]+)"/);
    if (!pivot) err("pivot", `Animated group "${id}" needs data-pivot="x y"`);
    else {
      const [x, y] = [Number(pivot[1]), Number(pivot[2])];
      if (x < 0 || x > 512 || y < 0 || y > 640) err("pivot.range", `Pivot of "${id}" is outside the viewBox`);
    }
  }

  for (const tag of FORBIDDEN_TAGS) {
    if (new RegExp(`<${tag}\\b`, "i").test(svg)) err("forbidden.tag", `<${tag}> is not allowed`);
  }
  if (/display="none"|display:\s*none|\sopacity="0"/.test(svg)) {
    err("hidden", 'Hidden variants must be visible in source (no display="none" / opacity="0")');
  }
  if (/mix-blend-mode/.test(svg)) err("forbidden.blend", "mix-blend-mode is not allowed");
  if ((svg.match(/<clipPath\b/g) ?? []).length > 2) err("clipPath.count", "At most 2 <clipPath> (eyes only)");
  if ((svg.match(/<(linear|radial)Gradient\b/g) ?? []).length > 2) err("gradient.count", "At most 2 gradients");

  for (const id of MOUTH_IDS) {
    const m = svg.match(new RegExp(`<g[^>]*\\sid="${id}"[^>]*>([\\s\\S]*?)</g>`));
    if (m && !/<(path|circle|ellipse|rect|polygon|line|polyline)\b/.test(m[1])) err("mouth.empty", `"${id}" has no shapes`);
  }

  const bytes = new TextEncoder().encode(svg).length;
  const elements = (svg.match(/<[a-zA-Z][^>]*>/g) ?? []).length;
  const paths = (svg.match(/<path\b/g) ?? []).length;
  const check = (name: string, v: number, target: number, cap: number) => {
    if (v > cap) err(`budget.${name}`, `${name} ${v} exceeds hard cap ${cap}`);
    else if (v > target) warn(`budget.${name}`, `${name} ${v} exceeds target ${target}`);
  };
  check("bytes", bytes, TARGET_BUDGET.maxBytes, HARD_CAP.maxBytes);
  check("elements", elements, TARGET_BUDGET.maxElements, HARD_CAP.maxElements);
  check("paths", paths, TARGET_BUDGET.maxPaths, HARD_CAP.maxPaths);

  return issues;
}

export const hasErrors = (issues: ContractIssue[]) => issues.some((i) => i.level === "error");
