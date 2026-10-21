// End-to-end check of the demo conversation in headless Chrome (fake mic, autoplay allowed).
// Needs `npm run dev` running. Usage: node scripts/e2e-conversation.mjs [baseUrl]
import { spawn } from "node:child_process";
const base = process.argv[2] ?? "http://localhost:3000";
const port = "9334";
const chrome = spawn(process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  "--headless=new", "--disable-gpu", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream",
  "--autoplay-policy=no-user-gesture-required", `--remote-debugging-port=${port}`, "--user-data-dir=/tmp/lactice-e2e-profile", "--window-size=420,900", "about:blank",
], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, userGesture: true, awaitPromise: true })).result?.result?.value;
const waitFor = async (expression, what, ms = 20000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await ev(expression)) return; await sleep(150); }
  throw new Error(`Timed out waiting for: ${what}\nStatus: ${await ev("document.querySelector('[data-testid=status]')?.textContent")}\nPage: ${(await ev("document.body.innerText")).slice(0, 600)}`);
};
const status = `document.querySelector('[data-testid=status]')?.textContent`;
const clickText = (t) => ev(`[...document.querySelectorAll('button')].find(b => b.textContent.includes(${JSON.stringify(t)}))?.click() ?? false`);
const clickLabel = (l) => ev(`document.querySelector('button[aria-label=${JSON.stringify(l)}]')?.click() ?? false`);
const waitTurnDone = (what) => waitFor(`${status} === 'Tap to speak'`, what);
const messages = () => ev(`[...document.querySelectorAll('ol li')].map(li => li.innerText.replace(/\\n/g,' | '))`);
const results = {};
try {
  let target;
  for (let i = 0; i < 40 && !target; i++) { await sleep(250); try { target = (await (await fetch(`http://localhost:${port}/json`)).json()).find((t) => t.type === "page"); } catch {} }
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
    else if (d.method === "Runtime.exceptionThrown") console.error("PAGE EXCEPTION:", d.params.exceptionDetails?.exception?.description ?? d.params.exceptionDetails?.text);
    else if (d.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(d.params.type)) console.error("PAGE CONSOLE", d.params.type, d.params.args.map((a) => a.value ?? a.description).join(" "));
  };
  await send("Page.enable"); await send("Runtime.enable");
  await send("Page.navigate", { url: `${base}/practice` });
  await waitFor(`document.body.innerText.includes('Start talking')`, "start button");

  // Sample which mouth shape is visible, to prove lip-sync actually moves.
  await ev(`window.__mouths = new Set(); window.__sam = setInterval(() => { const v = [...document.querySelectorAll("[id^='mouth_']")].find(e => e.getAttribute('visibility') === 'visible'); if (v) window.__mouths.add(v.id) }, 40); true`);

  // Retry the click until the app has hydrated and reacts.
  for (let i = 0; i < 40 && !(await ev(`!!document.querySelector('[data-testid=status]')`)); i++) { await clickText("Start talking"); await sleep(300); }
  await waitTurnDone("greeting finished");
  results.afterGreeting = await messages();

  await clickText("食べ物");
  await waitFor(`${status} !== 'Tap to speak'`, "topic reply starts");
  await waitTurnDone("topic reply finished");

  // Turn 1: a clear answer. Track every distinct status for diagnostics.
  await ev(`window.__tl = []; window.__tlT = setInterval(() => { const s = document.querySelector('[data-testid=status]')?.textContent; if (s && window.__tl.at(-1) !== s) window.__tl.push(s) }, 50); true`);
  results.clickStart = await clickLabel("Start recording");
  await waitFor(`${status}?.includes('Listening')`, "recording state");
  await sleep(3300); // long enough to always include the fake mic's periodic beep
  results.clickStop = await clickLabel("Stop and send");
  await waitFor(`${status}?.includes('Thinking') || ${status}?.includes('Speaking')`, "processing");
  await waitTurnDone("turn 1 reply");
  results.timelineTurn1 = await ev(`window.__tl`);
  results.afterTurn1 = (await messages()).slice(-3);

  // Turn 2: scripted STT returns an unclear utterance.
  await clickLabel("Start recording");
  await waitFor(`${status}?.includes('Listening')`, "recording 2");
  await sleep(3300); // long enough to always include the fake mic's periodic beep
  await clickLabel("Stop and send");
  await waitTurnDone("turn 2 reply");
  results.afterTurn2 = (await messages()).slice(-3);

  // Turn 3: the learner makes a genuine particle error (を instead of に) → correction card.
  await clickLabel("Start recording");
  await waitFor(`${status}?.includes('Listening')`, "recording 3a");
  await sleep(3300); // long enough to always include the fake mic's periodic beep
  await clickLabel("Stop and send");
  await waitFor(`!!document.querySelector('[data-testid=correction-card]')`, "correction card appears", 15000);
  results.cardBefore = await ev(`document.querySelector('[data-testid=correction-card]').innerText.replace(/\\n/g,' | ')`);
  await clickText("Show answer");
  results.cardAfter = await ev(`document.querySelector('[data-testid=correction-card]').innerText.replace(/\\n/g,' | ')`);
  await clickLabel("Report this correction as wrong");
  await waitFor(`document.querySelector('[data-testid=correction-card]').innerText.includes('Thanks')`, "report acknowledged", 5000);
  await waitTurnDone("turn 3 reply");

  await clickText("Hint");
  await waitFor(`document.body.innerText.includes('Hint 1/3')`, "hint banner", 8000);
  results.hint = await ev(`document.body.innerText.match(/Hint 1\\/3:[^\\n]*/)?.[0]`);

  // Interrupt: send another turn, and press the mic while the tutor is still speaking.
  await clickLabel("Start recording");
  await waitFor(`${status}?.includes('Listening')`, "recording 4");
  await sleep(3300); // long enough to always include the fake mic's periodic beep
  await clickLabel("Stop and send");
  await waitFor(`${status}?.includes('Speaking')`, "tutor speaking before interrupt");
  await clickLabel("Start recording"); // pressing the mic while the tutor speaks
  await sleep(1200); // long enough for the interrupted stream's late frames / turn_end to arrive
  results.statusAfterInterrupt = await ev(status);
  results.audioStoppedAfterInterrupt = await ev(`document.querySelector('button[aria-label="Stop and send"]') !== null`);
  await clickLabel("Stop and send"); // end this recording so the page is left in a clean state
  await waitTurnDone("turn after interrupt");
  await clickText("Hint");
  results.mouthsSeen = await ev(`[...window.__mouths].sort()`);
  results.errorBanner = await ev(`document.querySelector('[role=alert]')?.innerText ?? null`);
  results.finalStatus = await ev(status);
  console.log(JSON.stringify(results, null, 2));
} catch (e) {
  console.error("E2E FAILED:", e.message);
  process.exitCode = 1;
} finally {
  chrome.kill();
}
