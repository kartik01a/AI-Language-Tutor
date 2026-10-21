// Generates a crude placeholder tutor that satisfies the avatar contract (docs/03 Part B).
// Replace with real art later: the controller and validator only care about ids and pivots.
import { writeFileSync } from "node:fs";

const SKIN = "#F6D3B8", HAIR = "#3B2A3A", ACCENT = "#F47FA4", INK = "#1C1B2E", MOUTH = "#8B2E3F", TEETH = "#FFFFFF", TONGUE = "#E56B7F";
const EYE_L = [200, 290], EYE_R = [312, 290];

const eye = (s, [cx, cy]) => `
        <g id="eye_${s}">
          <ellipse id="eye_${s}_white" cx="${cx}" cy="${cy}" rx="22" ry="24" fill="#fff"/>
          <ellipse id="eye_${s}_pupil" data-pivot="${cx} ${cy}" cx="${cx}" cy="${cy}" rx="11" ry="13" fill="${INK}"/>
          <ellipse id="eye_${s}_lid" data-pivot="${cx} ${cy - 24}" cx="${cx}" cy="${cy}" rx="24" ry="26" fill="${SKIN}"/>
          <path id="eye_${s}_closed" d="M${cx - 20} ${cy} Q${cx} ${cy + 8} ${cx + 20} ${cy}" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round" visibility="hidden"/>
        </g>`;

const M = (id, body) => `        <g id="mouth_${id}" visibility="hidden">${body}</g>`;
const mouths = [
  M("rest", `<path d="M232 332 Q256 342 280 332" stroke="${MOUTH}" stroke-width="5" fill="none" stroke-linecap="round"/>`),
  M("mbp", `<path d="M234 334 L278 334" stroke="${MOUTH}" stroke-width="7" stroke-linecap="round"/>`),
  M("cons", `<path d="M230 326 Q256 322 282 326 Q256 346 230 326Z" fill="${MOUTH}"/><path d="M236 328 L276 328 L274 333 L238 333Z" fill="${TEETH}"/>`),
  M("a", `<ellipse cx="256" cy="336" rx="24" ry="20" fill="${MOUTH}"/><ellipse cx="256" cy="346" rx="14" ry="8" fill="${TONGUE}"/>`),
  M("i", `<path d="M226 330 Q256 322 286 330 Q256 346 226 330Z" fill="${MOUTH}"/><path d="M234 330 L278 330 L276 335 L236 335Z" fill="${TEETH}"/>`),
  M("u", `<ellipse cx="256" cy="334" rx="11" ry="12" fill="${MOUTH}"/>`),
  M("e", `<ellipse cx="256" cy="334" rx="21" ry="12" fill="${MOUTH}"/><path d="M240 330 L272 330 L270 334 L242 334Z" fill="${TEETH}"/>`),
  M("o", `<ellipse cx="256" cy="336" rx="16" ry="17" fill="${MOUTH}"/><ellipse cx="256" cy="342" rx="9" ry="6" fill="${TONGUE}"/>`),
  M("fv", `<path d="M232 328 Q256 322 280 328 Q256 344 232 328Z" fill="${MOUTH}"/><path d="M238 328 L274 328 L272 334 L240 334Z" fill="${TEETH}"/><path d="M240 336 Q256 346 272 336" stroke="${TONGUE}" stroke-width="5" fill="none" stroke-linecap="round"/>`),
  M("l_th", `<ellipse cx="256" cy="334" rx="20" ry="13" fill="${MOUTH}"/><path d="M238 328 L274 328 L272 333 L240 333Z" fill="${TEETH}"/><ellipse cx="256" cy="338" rx="9" ry="5" fill="${TONGUE}"/>`),
].join("\n");

const expr = (id, body) => `        <g id="expr_${id}" visibility="hidden">${body}</g>`;
const exprs = [
  expr("neutral", `<circle cx="256" cy="258" r="1" fill="${SKIN}"/>`),
  expr("happy", `<path d="M178 292 Q200 270 222 292" stroke="${INK}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M290 292 Q312 270 334 292" stroke="${INK}" stroke-width="6" fill="none" stroke-linecap="round"/>`),
  expr("thinking", `<circle cx="352" cy="232" r="6" fill="${ACCENT}"/><circle cx="368" cy="214" r="9" fill="${ACCENT}"/>`),
  expr("confused", `<path d="M352 226 q8 -14 20 -6 q8 8 -4 16 l-2 8" stroke="${ACCENT}" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="366" cy="258" r="4" fill="${ACCENT}"/>`),
  expr("encouraging", `<path d="M184 254 L216 248" stroke="${INK}" stroke-width="0" fill="none"/><circle cx="256" cy="258" r="1" fill="${SKIN}"/>`),
  expr("celebrating", `<path d="M150 200 l6 14 l14 6 l-14 6 l-6 14 l-6 -14 l-14 -6 l14 -6z" fill="#FFC23D"/><path d="M362 190 l5 11 l11 5 l-11 5 l-5 11 l-5 -11 l-11 -5 l11 -5z" fill="#FFC23D"/>`),
].join("\n");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" id="avatar" data-contract="1">
  <g id="rig" data-pivot="256 500">
    <ellipse id="shadow" cx="256" cy="496" rx="110" ry="12" fill="#1C1B2E" fill-opacity="0.12"/>
    <g id="body" data-pivot="256 500">
      <path id="torso" d="M120 512 Q124 420 256 410 Q388 420 392 512Z" fill="${ACCENT}"/>
      <g id="arm_l"><rect x="96" y="440" width="32" height="72" rx="16" fill="${ACCENT}"/></g>
      <g id="arm_r"><rect x="384" y="440" width="32" height="72" rx="16" fill="${ACCENT}"/></g>
    </g>
    <g id="head" data-pivot="256 410">
      <g id="head_base">
        <path d="M150 300 Q150 150 256 150 Q362 150 362 300 Q362 410 256 410 Q150 410 150 300Z" fill="${HAIR}"/>
        <path d="M160 300 Q160 200 256 200 Q352 200 352 300 Q352 396 256 396 Q160 396 160 300Z" fill="${SKIN}"/>
      </g>
      <g id="eyes">${eye("l", EYE_L)}${eye("r", EYE_R)}
      </g>
      <g id="brows">
        <path id="brow_l" data-pivot="200 262" d="M176 262 Q200 250 224 262" stroke="${HAIR}" stroke-width="6" fill="none" stroke-linecap="round"/>
        <path id="brow_r" data-pivot="312 262" d="M288 262 Q312 250 336 262" stroke="${HAIR}" stroke-width="6" fill="none" stroke-linecap="round"/>
      </g>
      <g id="cheeks"><ellipse cx="176" cy="326" rx="16" ry="9" fill="${ACCENT}" fill-opacity="0.35"/><ellipse cx="336" cy="326" rx="16" ry="9" fill="${ACCENT}" fill-opacity="0.35"/></g>
      <g id="mouth" data-pivot="256 334">
${mouths}
      </g>
      <g id="expr">
${exprs}
      </g>
      <g id="hair_front"><path d="M160 262 Q170 190 256 186 Q342 190 352 262 Q330 220 256 214 Q182 220 160 262Z" fill="${HAIR}"/></g>
    </g>
  </g>
</svg>
`;
writeFileSync(new URL("../assets/avatars/src/ja-yuki.svg", import.meta.url), svg);
console.log("wrote assets/avatars/src/ja-yuki.svg", svg.length, "bytes");
