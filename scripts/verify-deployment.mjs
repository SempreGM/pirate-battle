import { chromium } from "playwright";
import fs from "node:fs";
import assert from "node:assert/strict";

const url =
  process.env.DEPLOYMENT_URL ??
  "https://pirate-battle-jungle.bernardomaia57.chatgpt.site";
const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const errors = [];
const checks = [];
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 393, height: 851 }
        : { width: 1440, height: 1000 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto(url);
    assert.equal(response.status(), 200);
    await page.getByRole("button", { name: "Set sail" }).waitFor();
    await page.reload();
    await page.getByRole("button", { name: "Set sail" }).click();
    await page.locator(".arena canvas").waitFor();
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await page.keyboard.down("Space");
    await page.waitForTimeout(500);
    await page.keyboard.up("Space");
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.getByRole("button", { name: "Main Menu", exact: true }).click();
    const api = await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      const responses = await Promise.all([
        fetch("/api/ranking?page=1&pageSize=10"),
        fetch("/api/history?playerId=deployment-check&page=1&pageSize=10"),
      ]);
      return Promise.all(
        responses.map(async (r) => ({
          status: r.status,
          type: r.headers.get("content-type"),
        })),
      );
    });
    assert.ok(
      api.every((r) => r.type?.includes("application/json")),
      JSON.stringify(api),
    );
    checks.push({
      viewport: mobile ? "mobile" : "desktop",
      opening: true,
      reload: true,
      arena: true,
      pauseResume: true,
      mockApiResponses: api,
    });
    await context.close();
  }
  assert.deepEqual(errors, []);
  fs.mkdirSync("reports", { recursive: true });
  const report = {
    measuredAt: new Date().toISOString(),
    url,
    anonymousBrowser: true,
    checks,
    errors,
  };
  fs.writeFileSync("reports/deployment.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
