// What the main thread does while Le Jardin starts on a phone (package J-12):
// a Chromium trace of a first visit on an emulated phone (412 × 823 at 1.75×,
// the CPU four times slower, as Lighthouse's phone), cut at the moment the
// story's cover appears, and summed up by phase and by long task.
//
//   node scripts/run-local-e2e.mjs scripts/measure-start.mjs        the working tree
//   GAME_URL=https://permaculture-garden.vercel.app/ node scripts/measure-start.mjs
//
// MEASURE_RUNS=3 repeats it; TRACE_OUT=file.json keeps the last trace for
// chrome://tracing or the DevTools performance panel.
import { writeFile } from "node:fs/promises";
import { chromium } from "./load-playwright.mjs";

const url = process.env.GAME_URL || "http://127.0.0.1:8787/";
const runs = Number(process.env.MEASURE_RUNS || 1);

// main-thread events, grouped as DevTools does
const GROUPS = [
  ["parse HTML", /^(ParseHTML|HTMLDocumentParser::)/],
  ["parse CSS", /^(CSSParserImpl::parseStyleSheet\.parse|StyleElement::processStyleSheet)$/],
  ["compile script", /^V8\.(ParseProgram|PreParse|ParseFunction|CompileCode|CompileIgnition|Compile)$/],
  ["style", /^(Document::recalcStyle|UpdateLayoutTree)$/],
  ["layout", /^(LocalFrameView::performLayout|Layout)$/],
  ["paint", /^(Paint|PrePaint|Layerize|Commit)$/],
  ["garbage collection", /^(MinorGC|MajorGC|V8\.GC)/],
  ["decode images", /^(ImageDecodeTask|Decode Image|ImageFrameGenerator::decode)/]
];

function summarize(trace, coverAt) {
  const events = trace.traceEvents || trace;
  const threadNames = new Map(events.filter(e => e.ph === "M" && e.name === "thread_name").map(e => [`${e.pid}:${e.tid}`, e.args.name]));
  const counts = new Map();
  for (const e of events) {
    const key = `${e.pid}:${e.tid}`;
    if (threadNames.get(key) === "CrRendererMain") counts.set(key, (counts.get(key) || 0) + 1);
  }
  const main = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const X = events.filter(e => `${e.pid}:${e.tid}` === main && e.ph === "X" && e.dur).sort((a, b) => a.ts - b.ts || b.dur - a.dur);
  const navigation = events.find(e => e.name === "navigationStart" || e.name === "NavigationBodyLoader::StartLoadingBody") || X[0];
  const t0 = navigation.ts;
  const end = t0 + coverAt * 1000;
  const inWindow = X.filter(e => e.ts < end);
  const tasks = inWindow.filter(e => e.name === "RunTask");
  const busy = tasks.reduce((sum, e) => sum + e.dur, 0) / 1000;
  // time per group: the outermost matching event in each task, so nested ones count once
  const grouped = new Map(GROUPS.map(([name]) => [name, 0]));
  let script = 0;
  for (const task of tasks) {
    const inside = inWindow.filter(e => e.ts >= task.ts && e.ts + e.dur <= task.ts + task.dur && e !== task);
    for (const [name, pattern] of GROUPS) {
      let last = -1;
      for (const e of inside) {
        if (!pattern.test(e.name) || e.ts < last) continue;
        grouped.set(name, grouped.get(name) + e.dur / 1000);
        last = e.ts + e.dur;
      }
    }
    let last = -1;
    for (const e of inside) {
      if (!["FunctionCall", "EvaluateScript", "v8.callFunction", "TimerFire", "FireAnimationFrame"].includes(e.name) || e.ts < last) continue;
      script += e.dur / 1000;
      last = e.ts + e.dur;
    }
  }
  const long = tasks.filter(e => e.dur >= 50000).map(task => {
    const inside = inWindow.filter(e => e.ts >= task.ts && e.ts + e.dur <= task.ts + task.dur && e !== task);
    const script = inside.find(e => e.name === "EvaluateScript" || e.name === "FunctionCall");
    const url = script && script.args && script.args.data && script.args.data.url ? script.args.data.url.split("/").pop() : "";
    const parts = GROUPS.map(([name, pattern]) => {
      let ms = 0, last = -1;
      for (const e of inside) if (pattern.test(e.name) && e.ts >= last) { ms += e.dur / 1000; last = e.ts + e.dur; }
      return ms >= 5 ? `${name} ${Math.round(ms)}` : null;
    }).filter(Boolean);
    return { at: Math.round((task.ts - t0) / 1000), ms: Math.round(task.dur / 1000), script: url || (script ? "(script without a file)" : ""), parts };
  });
  return { coverAt, busy: Math.round(busy), script: Math.round(script), groups: Object.fromEntries([...grouped].map(([k, v]) => [k, Math.round(v)])), long };
}

const browser = await chromium.launch({ headless: true });
let last;
for (let run = 1; run <= runs; run += 1) {
  const context = await browser.newContext({ viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true, reducedMotion: "no-preference" });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const traceFile = process.env.TRACE_OUT || null;
  await browser.startTracing(page, { categories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "v8", "disabled-by-default-v8.compile", "blink", "loading"] });
  const started = Date.now();
  await page.goto(url, { waitUntil: "commit" });
  // poll through the protocol, not with Playwright's selector engine, which
  // would add its own script to the trace
  let coverAt = null;
  while (Date.now() - started < 60000) {
    const { result } = await cdp.send("Runtime.evaluate", { expression: "(() => { const c = document.querySelector('.pg-story-cover-card'); return c && c.getBoundingClientRect().height > 0 ? performance.now() : 0; })()" });
    if (result.value) { coverAt = result.value; break; }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  await new Promise(resolve => setTimeout(resolve, 500));
  const buffer = await browser.stopTracing();
  if (traceFile) await writeFile(traceFile, buffer);
  await context.close();
  if (!coverAt) throw new Error("The story cover did not appear within 60 s.");
  last = summarize(JSON.parse(buffer.toString("utf8")), coverAt);
  console.log(`run ${run}: the cover appears at ${Math.round(last.coverAt)} ms; main thread busy ${last.busy} ms, scripts ${last.script} ms`);
  console.log("  " + Object.entries(last.groups).map(([k, v]) => `${k} ${v}`).join(" · "));
  for (const task of last.long) console.log(`  long task at ${task.at} ms: ${task.ms} ms ${task.script} (${task.parts.join(", ")})`);
}
await browser.close();
