import { chromium } from "playwright";
import fs from "node:fs";

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(
    process.env.DEPLOYMENT_URL ??
      "https://pirate-battle-sempregm.vercel.app",
  );
  const samples = [];
  for (let cycle = 1; cycle <= 20; cycle++) {
    await page.getByRole("button", { name: "Set sail" }).click();
    await page.locator(".arena canvas").waitFor();
    await page.keyboard.down("Space");
    await page.waitForTimeout(2000);
    await page.keyboard.up("Space");
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.getByRole("button", { name: "Main Menu", exact: true }).click();
    await page.waitForTimeout(500);
    await cdp.send("HeapProfiler.collectGarbage");
    const metrics = (await cdp.send("Performance.getMetrics")).metrics;
    samples.push({
      cycle,
      ...(await cdp.send("Memory.getDOMCounters")),
      heapBytes: metrics.find((m) => m.name === "JSHeapUsedSize")?.value,
    });
  }
  fs.writeFileSync(
    "reports/memory-20-cycles.json",
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        browser: browser.version(),
        softwareRendering: true,
        playSecondsPerCycle: 2,
        samples,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({ first: samples[0], last: samples.at(-1), errors }),
  );
} finally {
  await browser.close();
}
