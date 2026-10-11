import { chromium } from "playwright";
import fs from "node:fs";
import os from "node:os";
const browser = await chromium.launch({
  headless: process.env.PROFILE_HEADED !== "1",
  args: [
    ...(process.env.PROFILE_SOFTWARE === "1"
      ? ["--use-angle=swiftshader"]
      : []),
    "--enable-webgl",
    "--ignore-gpu-blocklist",
  ],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const cdp = await page.context().newCDPSession(page);
await cdp.send("Performance.enable");
const url = process.env.PROFILE_URL ?? "http://127.0.0.1:4173";
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.goto(url + "/?profile=1&seed=3");
await page.getByRole("button", { name: "Options", exact: true }).click();
await page.getByLabel("Game session time").fill("180");
await page.getByLabel("Enemy spawn time").fill("10");
await page.getByRole("button", { name: "Save", exact: true }).click();
await page.getByRole("button", { name: "Back", exact: true }).click();
await page.getByRole("button", { name: "Set sail" }).click();
await page.waitForFunction(() => !!window.__PIRATE_PROFILE__);
const renderingDevice = await page.evaluate(() => {
  const canvas = document.querySelector(".arena canvas");
  const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  const extension = gl.getExtension("WEBGL_debug_renderer_info");
  return extension
    ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)
    : gl.getParameter(gl.RENDERER);
});
await page.getByRole("button", { name: "Sound on", exact: true }).click();
const frames = [],
  entities = [];
let activeDuration = 0,
  route = 0,
  score = 0;
const wp = [
  [600, 710],
  [50, 710],
  [50, 50],
  [1150, 50],
  [1150, 710],
];
const held = new Set();
async function keys(next) {
  for (const key of [...held])
    if (!next.includes(key)) {
      await page.keyboard.up(key);
      held.delete(key);
    }
  for (const key of next)
    if (!held.has(key)) {
      await page.keyboard.down(key);
      held.add(key);
    }
}
const started = performance.now();
while (performance.now() - started < 240000) {
  const state = await page.evaluate(() => {
    const p = window.__PIRATE_PROFILE__;
    if (!p) return null;
    return {
      ...p.snapshot(),
      frames: p.frames.splice(0),
      entities: p.entities.splice(0),
    };
  });
  if (!state) break;
  frames.push(...state.frames);
  entities.push(...state.entities);
  activeDuration = state.elapsed;
  score = state.score;
  if (Math.hypot(wp[route][0] - state.x, wp[route][1] - state.y) < 35)
    route = (route + 1) % wp.length;
  const angle = Math.atan2(wp[route][1] - state.y, wp[route][0] - state.x),
    delta = Math.atan2(
      Math.sin(angle - state.angle),
      Math.cos(angle - state.angle),
    );
  const next = ["Space", "KeyQ", "KeyE"];
  if (Math.abs(delta) > 0.08) next.push(delta > 0 ? "KeyD" : "KeyA");
  if (Math.abs(delta) < 0.5) next.push("KeyW");
  await keys(next);
  await page.waitForTimeout(
    Math.max(
      10,
      Math.min(
        100,
        Math.abs(delta) > 0.08 ? (Math.abs(delta) / 2.6) * 1000 : 100,
      ),
    ),
  );
}
await keys([]);
await page.waitForSelector(".result");
const result = await page.evaluate(() =>
  JSON.parse(localStorage.getItem("pirate-battle:last-result")),
);
const sorted = [...frames].sort((a, b) => a - b),
  total = frames.reduce((a, b) => a + b, 0);
const memory = [];
await page.getByRole("button", { name: "Main Menu", exact: true }).click();
async function sample(label) {
  await cdp.send("HeapProfiler.collectGarbage");
  const metrics = (await cdp.send("Performance.getMetrics")).metrics;
  return {
    label,
    ...(await cdp.send("Memory.getDOMCounters")),
    heapBytes: metrics.find((m) => m.name === "JSHeapUsedSize")?.value,
  };
}
memory.push(await sample("baseline"));
for (let cycle = 1; cycle <= 5; cycle++) {
  await page.getByRole("button", { name: "Set sail" }).click();
  await page.waitForFunction(() => !!window.__PIRATE_PROFILE__);
  await page.keyboard.down("Space");
  await page.waitForTimeout(2000);
  await page.keyboard.up("Space");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Main Menu", exact: true }).click();
  await page.waitForTimeout(300);
  memory.push(await sample(`cycle-${cycle}`));
}
const report = {
  measuredAt: new Date().toISOString(),
  environment: {
    platform: os.platform(),
    release: os.release(),
    cpu: os.cpus()[0]?.model,
    cpuCount: os.cpus().length,
    totalMemory: os.totalmem(),
    browser: browser.version(),
    resolution: "1440x1000",
    renderer: renderingDevice,
  },
  config: result.config,
  reason: result.reason,
  activeDuration: result.duration ?? activeDuration,
  score: result.score ?? score,
  frames: frames.length,
  fps: frames.length / (total / 1000),
  frameIntervalP95: sorted[Math.floor(sorted.length * 0.95)],
  maxEntities: Math.max(...entities),
  memory,
  errors,
  limitations: [
    "Headless browser results must be compared with interactive browser measurements on the target hardware.",
    "Five-cycle measurement is a bounded smoke investigation, not a long-duration leak proof.",
    "MSW/React query caches and shared Pixi texture caches remain alive intentionally.",
  ],
};
fs.mkdirSync("reports", { recursive: true });
fs.writeFileSync(
  process.env.PROFILE_OUTPUT ?? "reports/profile.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
await browser.close();
