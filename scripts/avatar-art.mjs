// `node scripts/avatar-art.mjs` — turns the hand-made art in assets/avatars/src/*.png into the
// compressed WebP that hybrid avatars reference (public/avatars/<name>-art.webp). Run after changing a PNG.
import { readdirSync, mkdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const dir = new URL("../assets/avatars/src/", import.meta.url);
const out = new URL("../public/avatars/", import.meta.url);
mkdirSync(out, { recursive: true });
for (const f of readdirSync(dir).filter((f) => f.endsWith(".png") && !f.startsWith("_"))) {
  const dest = new URL(f.replace(/\.png$/, "-art.webp"), out);
  await sharp(fileURLToPath(new URL(f, dir)))
    .resize(800, 800, { fit: "inside" })
    .webp({ quality: 86, alphaQuality: 90 })
    .toFile(fileURLToPath(dest));
  console.log(`${f} -> public/avatars/${dest.pathname.split("/").pop()} (${Math.round(statSync(dest).size / 1024)} KB)`);
}
