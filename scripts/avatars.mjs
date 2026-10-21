// `node scripts/avatars.mjs validate|build` — validates sources against the contract and copies
// them to public/avatars. (SVGO optimisation is added once real art exists; see docs/03 §B8.)
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";

const { validateAvatarSvg, hasErrors } = await import("../lib/avatar/contract.ts");
const dir = new URL("../assets/avatars/src/", import.meta.url);
const out = new URL("../public/avatars/", import.meta.url);
const mode = process.argv[2] ?? "validate";
let failed = false;
mkdirSync(out, { recursive: true });
for (const f of readdirSync(dir).filter((f) => f.endsWith(".svg"))) {
  const svg = readFileSync(new URL(f, dir), "utf8");
  const issues = validateAvatarSvg(svg, process.env.AVATAR_TIER === "production" ? "production" : "mvp");
  for (const i of issues) console.log(`${i.level.toUpperCase()} ${f} [${i.rule}] ${i.message}`);
  if (hasErrors(issues)) failed = true;
  else if (mode === "build") {
    const hash = createHash("sha1").update(svg).digest("hex").slice(0, 8);
    const name = f.replace(/\.svg$/, `.${hash}.svg`);
    writeFileSync(new URL(name, out), svg);
    writeFileSync(new URL(f.replace(/\.svg$/, ".json"), out), JSON.stringify({ file: name, bytes: svg.length }));
    console.log(`built ${name}`);
  } else console.log(`OK ${f}`);
}
process.exit(failed ? 1 : 0);
