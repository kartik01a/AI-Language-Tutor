// Browser check against REAL providers: start a session in headless Chrome, let Yuki's real Azure MP3
// greeting play, and confirm the avatar's mouth moves from real viseme timing. Needs `PROVIDERS=real npm run dev`.
// Usage: node scripts/e2e-greeting.mjs [baseUrl]
import { spawn } from "node:child_process";
const base = process.argv[2] ?? "http://localhost:3000";
const port = "9335";
const chrome = spawn(process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  "--headless=new", "--disable-gpu", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream",
  "--autoplay-policy=no-user-gesture-required", `--remote-debugging-port=${port}`, "--user-data-dir=/tmp/lactice-greet-profile", "about:blank",
], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pending = new Map();
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, userGesture: true })).result?.result?.value;
try {
  let target;
  for (let i = 0; i < 40 && !target; i++) { await sleep(250); try { target = (await (await fetch(`http://localhost:${port}/json`)).json()).find((t) => t.type === "page"); } catch {} }
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } else if (d.method === "Runtime.exceptionThrown") console.error("PAGE EXCEPTION:", d.params.exceptionDetails?.exception?.description); };
  await send("Page.enable"); await send("Runtime.enable");
  await send("Page.navigate", { url: `${base}/practice` });
  for (let i = 0; i < 40 && !(await ev(`document.body.innerText.includes('Start talking')`)); i++) await sleep(250);
  await ev(`window.__m = new Set(); setInterval(() => { const v = [...document.querySelectorAll("[id^='mouth_']")].find(e => e.getAttribute('visibility') === 'visible'); if (v) window.__m.add(v.id) }, 30); true`);
  for (let i = 0; i < 40 && !(await ev(`!!document.querySelector('[data-testid=status]')`)); i++) { await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Start talking'))?.click()`); await sleep(300); }
  let status = "";
  for (let i = 0; i < 80; i++) { status = await ev(`document.querySelector('[data-testid=status]')?.textContent`); if (status === "Tap to speak") break; await sleep(250); }
  console.log(JSON.stringify({ status, messages: await ev(`[...document.querySelectorAll('ol li')].map(li => li.innerText.replace(/\\n/g,' | '))`), mouthsSeen: await ev(`[...window.__m].sort()`), error: await ev(`document.querySelector('[role=alert]')?.innerText ?? null`) }, null, 1));
} finally { chrome.kill(); }
