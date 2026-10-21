// Browser check of /dev/record: record one clip with the fake mic, save it, confirm the file exists.
// Needs `npm run dev`. Usage: node scripts/e2e-record.mjs [baseUrl]
import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
const base = process.argv[2] ?? "http://localhost:3000";
const port = "9336";
const chrome = spawn(process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", "--disable-gpu", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required", `--remote-debugging-port=${port}`, "--user-data-dir=/tmp/lactice-rec-profile", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pending = new Map();
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, userGesture: true })).result?.result?.value;
const waitFor = async (expr, what, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(expr)) return; await sleep(150); } throw new Error("timed out: " + what + " | " + (await ev("document.body.innerText")).slice(0, 300)); };
const click = (t) => ev(`[...document.querySelectorAll('button')].find(b => b.textContent.includes(${JSON.stringify(t)}))?.click()`);
if (existsSync("eval/audio/zz-e2e")) { console.error("eval/audio/zz-e2e already exists; refusing to overwrite"); process.exit(1); }
try {
  let target; for (let i = 0; i < 40 && !target; i++) { await sleep(250); try { target = (await (await fetch(`http://localhost:${port}/json`)).json()).find((t) => t.type === "page"); } catch {} }
  ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } else if (d.method === "Runtime.exceptionThrown") console.error("PAGE EXCEPTION:", d.params.exceptionDetails?.exception?.description); };
  await send("Page.enable"); await send("Runtime.enable");
  await send("Page.navigate", { url: `${base}/dev/record` });
  await waitFor(`document.body.innerText.includes('saved')`, "page loads");
  // Use a throwaway speaker so a real recording can never be overwritten by this test. Retry until the
  // value STICKS: typing before React has hydrated gets reset to the default.
  for (let i = 0; i < 20; i++) {
    await ev(`(() => { const i = document.querySelector('input'); i.focus(); i.select(); })()`);
    await send("Input.insertText", { text: "zz-e2e" });
    await sleep(700);
    if ((await ev(`document.querySelector('input').value`)) === "zz-e2e") break;
  }
  if ((await ev(`document.querySelector('input').value`)) !== "zz-e2e") throw new Error("could not set the throwaway speaker; refusing to continue");
  for (let i = 0; i < 20 && !(await ev(`document.body.innerText.includes('Recording…')`)); i++) { await click("Record"); await sleep(400); }
  await sleep(2500); await click("Stop");
  await waitFor(`!!document.querySelector('audio')`, "review player appears");
  await click("Save");
  await waitFor(`document.querySelector('[data-testid=progress]')?.innerText.startsWith('1 of')`, "progress shows 1 saved");
  const where = await ev(`Promise.all([fetch('/api/dev/clips?speaker=zz-e2e').then(r => r.json()), fetch('/api/dev/clips?speaker=me').then(r => r.json())]).then(x => JSON.stringify(x))`);
  console.log('saved lists [zz-e2e, me]:', await where, '| input value:', await ev(`document.querySelector('input').value`));
  console.log(JSON.stringify({ progress: await ev(`document.querySelector('[data-testid=progress]').innerText`), nextPhrase: await ev(`document.querySelector('[lang=ja]').innerText`), fileSaved: existsSync("eval/audio/zz-e2e/p01.wav") }));
} finally { chrome.kill(); rmSync("eval/audio/zz-e2e", { recursive: true, force: true }); }
