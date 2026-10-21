// Minimal Chrome DevTools Protocol runner: open a URL in headless Chrome (fake mic, autoplay allowed)
// and poll a JS expression until it is truthy, then print it. Needs a running dev server.
//   node scripts/cdp-eval.mjs "http://localhost:3000/dev/audio?auto=1" "<js expression>"
// Set CHROME to override the browser path.
import { spawn } from "node:child_process";
const [url, expr, port = "9333"] = process.argv.slice(2);
const chrome = spawn(process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  "--headless=new", "--disable-gpu", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream",
  "--autoplay-policy=no-user-gesture-required", `--remote-debugging-port=${port}`, "--user-data-dir=/tmp/lactice-chrome-profile", "about:blank",
], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  let target;
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(250);
    try { target = (await (await fetch(`http://localhost:${port}/json`)).json()).find((t) => t.type === "page"); } catch {}
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  await send("Page.enable"); await send("Runtime.enable");
  await send("Page.navigate", { url });
  let value = null;
  for (let i = 0; i < 80 && !value; i++) {
    await sleep(500);
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
    value = r.result?.result?.value || null;
  }
  console.log(value ?? "TIMEOUT");
} finally { chrome.kill(); }
