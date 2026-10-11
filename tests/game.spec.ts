import { test, expect, type Page } from "@playwright/test";
import { ISLANDS } from "../src/game/simulation";
const uncaughtErrors = new WeakMap<Page, string[]>();
async function start(page: Page) {
  await page.goto("/?test=1&seed=42");
  await page.getByRole("button", { name: "Set sail" }).click();
  await page.waitForFunction(() => !!window.__PIRATE_TEST__);
}
async function advance(page: Page, seconds: number) {
  await page.evaluate(
    (seconds) => window.__PIRATE_TEST__!.advance(seconds),
    seconds,
  );
}
async function snapshot(page: Page) {
  return page.evaluate(() => window.__PIRATE_TEST__!.snapshot());
}
async function scenario(page: Page, value: string) {
  await page.getByRole("button", { name: "Harbor status" }).click();
  await page.getByLabel("Network scenario").selectOption(value);
  await page.getByRole("button", { name: "Done", exact: true }).click();
}
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  uncaughtErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    if (!localStorage.getItem("pirate-battle:player"))
      localStorage.setItem(
        "pirate-battle:player",
        JSON.stringify({ id: "test-captain", name: "Captain" }),
      );
  });
});
test.afterEach(async ({ page }) => {
  expect(uncaughtErrors.get(page) ?? []).toEqual([]);
});
test("options validate and persist across refresh", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Options", exact: true }).click();
  await page.getByLabel("Game session time").fill("59");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "Use whole numbers",
  );
  await page.getByLabel("Game session time").fill("60");
  await page.getByLabel("Enemy spawn time").fill("10");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "Options saved",
  );
  const saved = await page.evaluate(() =>
    localStorage.getItem("pirate-battle:options"),
  );
  expect(JSON.parse(saved!)).toEqual({ sessionSeconds: 60, spawnSeconds: 10 });
  await page.reload();
  await page.getByRole("button", { name: "Options", exact: true }).click();
  await expect(page.getByLabel("Game session time")).toHaveValue("60");
  await expect(page.getByLabel("Enemy spawn time")).toHaveValue("10");
});
test("movement rotation islands and arena bounds", async ({ page }) => {
  await start(page);
  const initial = await snapshot(page);
  await page.keyboard.down("KeyW");
  await advance(page, 0.5);
  await page.keyboard.up("KeyW");
  expect((await snapshot(page)).player.y).toBeLessThan(initial.player.y - 50);
  await page.keyboard.down("KeyD");
  await advance(page, 0.3);
  await page.keyboard.up("KeyD");
  expect((await snapshot(page)).player.angle).toBeGreaterThan(
    initial.player.angle,
  );
  await page.keyboard.down("KeyW");
  await advance(page, 10);
  await page.keyboard.up("KeyW");
  const { player } = await snapshot(page);
  expect(player.x).toBeGreaterThanOrEqual(player.radius);
  expect(player.x).toBeLessThanOrEqual(1200 - player.radius);
  expect(player.y).toBeGreaterThanOrEqual(player.radius);
  for (const island of ISLANDS)
    expect(
      Math.hypot(player.x - island.x, player.y - island.y),
    ).toBeGreaterThanOrEqual(player.radius + island.radius - 0.01);
});
test("frontal and parallel lateral attacks respect independent cooldowns", async ({
  page,
}) => {
  await start(page);
  await page.keyboard.down("Space");
  await page.keyboard.down("KeyQ");
  await page.keyboard.down("KeyE");
  await advance(page, 0.01);
  let state = await snapshot(page);
  expect(state.projectiles).toHaveLength(7);
  const left = state.projectiles.filter(
    (p) => Math.abs(p.angle + Math.PI) < 0.001,
  );
  expect(left).toHaveLength(3);
  expect(new Set(left.map((p) => p.y)).size).toBe(3);
  await advance(page, 0.1);
  state = await snapshot(page);
  expect(state.projectiles).toHaveLength(7);
  await page.keyboard.up("Space");
  await page.keyboard.up("KeyQ");
  await page.keyboard.up("KeyE");
});
test("Chaser and Shooter spawn on interval and behave differently", async ({
  page,
}) => {
  await start(page);
  await advance(page, 2.9);
  expect((await snapshot(page)).enemies).toHaveLength(0);
  await advance(page, 0.2);
  const first = (await snapshot(page)).enemies[0];
  expect(first.kind).toBe("chaser");
  await advance(page, 3.1);
  const state = await snapshot(page);
  expect(state.enemies.some((e) => e.kind === "shooter")).toBe(true);
  const chaser = state.enemies.find((e) => e.id === first.id);
  if (chaser) expect(chaser.x === first.x && chaser.y === first.y).toBe(false);
});
test("manual and automatic pause freeze time and require explicit resume", async ({
  page,
}) => {
  await start(page);
  await advance(page, 5);
  await page.keyboard.down("KeyW");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const before = await snapshot(page);
  await advance(page, 30);
  expect(await snapshot(page)).toEqual(before);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await advance(page, 0.5);
  expect((await snapshot(page)).player).toEqual(before.player);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  expect((await snapshot(page)).phase).toBe("paused");
});
test("abandoning combat preserves completed records and restarts cleanly", async ({
  page,
}) => {
  await start(page);
  await advance(page, 4);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Main Menu", exact: true }).click();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("pirate-battle:confirmed") ?? "[]"),
    ),
  ).toEqual([]);
  await page.getByRole("button", { name: "Set sail" }).click();
  await page.waitForFunction(() => !!window.__PIRATE_TEST__);
  expect((await snapshot(page)).elapsed).toBe(0);
  expect((await snapshot(page)).health).toBe(100);
  expect((await snapshot(page)).enemies).toHaveLength(0);
});
test("touch controls allow movement and firing together", async ({ page }) => {
  await start(page);
  const before = await snapshot(page);
  const forward = (await page
      .getByRole("button", { name: "Forward", exact: true })
      .boundingBox())!,
    fire = (await page
      .getByRole("button", { name: "Fire front", exact: true })
      .boundingBox())!;
  const session = await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      {
        x: forward.x + forward.width / 2,
        y: forward.y + forward.height / 2,
        id: 1,
      },
      { x: fire.x + fire.width / 2, y: fire.y + fire.height / 2, id: 2 },
    ],
  });
  await advance(page, 0.2);
  const after = await snapshot(page);
  expect(after.player.y).toBeLessThan(before.player.y);
  expect(after.projectiles.length).toBeGreaterThan(0);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await session.detach();
});
test("ranking pagination empty and failure recovery", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Page 1 of 4")).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Page 2 of 4")).toBeVisible();
  await scenario(page, "empty");
  await expect(
    page.getByText("These waters have no legends yet. Be the first."),
  ).toBeVisible();
  await scenario(page, "ranking-failure");
  await expect(page.getByRole("alert")).toContainText("unavailable");
  await page.getByRole("tab", { name: "Match History", exact: true }).click();
  await expect(
    page.getByText("Your story starts with your first completed voyage."),
  ).toBeVisible();
  await scenario(page, "success");
  await page.getByRole("tab", { name: "Ranking", exact: true }).click();
  await expect(page.getByText("Page 1 of 4")).toBeVisible();
});
test("death result registers once and retry after post-commit timeout recovers", async ({
  page,
}) => {
  await page.goto("/?test=1&seed=42");
  await scenario(page, "post-commit-timeout");
  await page.getByRole("button", { name: "Set sail" }).click();
  await page.waitForFunction(() => !!window.__PIRATE_TEST__);
  await advance(page, 120);
  await expect(page.getByText("VOYAGE COMPLETE")).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("pirate-battle:confirmed") ?? "[]")
            .length,
      ),
    )
    .toBe(1);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("pirate-battle:confirmed") ?? "[]")
          .length,
    ),
  ).toBe(1);
  // Automatic retry recovers the committed ID without creating a second record.
  await expect(page.getByText("confirmed", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("pirate-battle:confirmed") ?? "[]")
          .length,
    ),
  ).toBe(1);
  await page.getByRole("button", { name: "Main Menu", exact: true }).click();
  await page.getByRole("tab", { name: "Match History", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
});
test("visual menu arena and result", async ({ page }) => {
  await page.goto("/?test=1&seed=42");
  await expect(page.getByText("Page 1 of 4")).toBeVisible();
  await expect(page).toHaveScreenshot("menu.png", { fullPage: true });
  await page.getByRole("button", { name: "Set sail" }).click();
  await page.waitForFunction(() => !!window.__PIRATE_TEST__);
  await expect(page).toHaveScreenshot("arena.png");
  await advance(page, 120);
  await expect(page.getByText("confirmed", { exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot("result.png", { fullPage: true });
});
test("asset failures stop combat and allow retry", async ({ page }) => {
  await page
    .context()
    .route("**/assets/png/retina/ships/ship_7.png", (route) => route.abort());
  await page.goto("/?test=1&seed=42");
  await page.getByRole("button", { name: "Set sail" }).click();
  await expect(page.getByRole("alert")).toContainText("Unable to load");
  expect(await page.evaluate(() => !!window.__PIRATE_TEST__)).toBe(false);
  await page.context().unroute("**/assets/png/retina/ships/ship_7.png");
  await page.getByRole("button", { name: "Retry assets", exact: true }).click();
  await page.waitForFunction(() => !!window.__PIRATE_TEST__);
  expect((await snapshot(page)).elapsed).toBe(0);
});
test("outage keeps all pending voyages through refresh and another combat session", async ({
  page,
}) => {
  await page.goto("/?test=1&seed=42");
  await scenario(page, "outage");
  await page.getByRole("button", { name: "Set sail" }).click();
  await page.waitForFunction(() => !!window.__PIRATE_TEST__);
  await advance(page, 120);
  await expect(page.getByText("VOYAGE COMPLETE")).toBeVisible();
  await page.reload();
  await expect(page.getByText("VOYAGE COMPLETE")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("pirate-battle:queue") ?? "[]").length,
    ),
  ).toBe(1);
  await page.getByRole("button", { name: "Play Again", exact: true }).click();
  await page.waitForFunction(() => !!window.__PIRATE_TEST__);
  await advance(page, 120);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("pirate-battle:queue") ?? "[]").length,
    ),
  ).toBe(2);
  await scenario(page, "success");
  await page
    .getByRole("button", { name: "Retry pending", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("pirate-battle:queue") ?? "[]")
            .length,
      ),
    )
    .toBe(0);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("pirate-battle:confirmed") ?? "[]")
          .length,
    ),
  ).toBe(2);
});
test("delayed ranking responses cannot replace a newer page", async ({
  page,
}) => {
  await page.goto("/");
  await scenario(page, "out-of-order");
  await expect(page.getByText("Page 1 of 4")).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Page 2 of 4")).toBeVisible();
  await page.getByRole("tab", { name: "Match History", exact: true }).click();
  await page.getByRole("tab", { name: "Ranking", exact: true }).click();
  await expect(page.getByText("Page 1 of 4")).toBeVisible();
  await expect(page.locator("tbody tr").first()).toContainText("Blackbeard");
});
test("combat hits award one point per destruction and clear dead entities", async ({
  page,
}) => {
  await start(page);
  await advance(page, 3.1);
  let state = await snapshot(page);
  const originalHealth = state.enemies[0].health;
  await page.keyboard.down("Space");
  for (
    let attempt = 0;
    attempt < 80 && state.score === 0 && state.phase === "running";
    attempt++
  ) {
    const enemy = state.enemies[0];
    if (enemy) {
      const angle = Math.atan2(
          enemy.y - state.player.y,
          enemy.x - state.player.x,
        ),
        delta = Math.atan2(
          Math.sin(angle - state.player.angle),
          Math.cos(angle - state.player.angle),
        );
      const key = delta > 0 ? "KeyD" : "KeyA";
      if (Math.abs(delta) > 0.03) {
        await page.keyboard.down(key);
        await advance(page, Math.min(Math.abs(delta) / 2.6, 0.15));
        await page.keyboard.up(key);
      }
    }
    await advance(page, 0.1);
    state = await snapshot(page);
  }
  await page.keyboard.up("Space");
  expect(originalHealth).toBe(30);
  expect(state.score).toBeGreaterThanOrEqual(1);
  expect(state.enemies.every((e) => e.health > 0)).toBe(true);
});
test("time expiry persists its result and ranks only matching configurations", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/?test=1&seed=3");
  await page.getByRole("button", { name: "Options", exact: true }).click();
  await page.getByLabel("Game session time").fill("60");
  await page.getByLabel("Enemy spawn time").fill("10");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Set sail" }).click();
  await page.waitForFunction(() => !!window.__PIRATE_TEST__);
  const wp = [
    [600, 710],
    [50, 710],
    [50, 50],
    [1150, 50],
    [1150, 710],
  ];
  let target = 0;
  const held = new Set<string>();
  for (
    let i = 0;
    i < 1500 && (await page.evaluate(() => !!window.__PIRATE_TEST__));
    i++
  ) {
    const state = await snapshot(page),
      p = state.player;
    if (Math.hypot(wp[target][0] - p.x, wp[target][1] - p.y) < 35)
      target = (target + 1) % wp.length;
    const angle = Math.atan2(wp[target][1] - p.y, wp[target][0] - p.x),
      delta = Math.atan2(Math.sin(angle - p.angle), Math.cos(angle - p.angle));
    const next = ["Space", "KeyQ", "KeyE"];
    if (Math.abs(delta) > 0.08) next.push(delta > 0 ? "KeyD" : "KeyA");
    if (Math.abs(delta) < 0.5) next.push("KeyW");
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
    await advance(
      page,
      Math.min(0.25, Math.abs(delta) > 0.08 ? Math.abs(delta) / 2.6 : 0.25),
    );
  }
  for (const key of held) await page.keyboard.up(key);
  await expect(page.getByText("Time expired", { exact: true })).toBeVisible();
  await expect(page.getByText("confirmed", { exact: true })).toBeVisible();
  const record = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("pirate-battle:last-result")!),
  );
  expect(record.duration).toBe(60);
  expect(record.config.spawnSeconds).toBe(10);
  await page.reload();
  await expect(page.getByText("Time expired", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Main Menu", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody")).toContainText("Captain");
});
test("history pagination uses the same multi-page demo records as ranking", async ({
  page,
}) => {
  await page.goto("/");
  await scenario(page, "multiple-pages");
  await page.getByRole("tab", { name: "Match History", exact: true }).click();
  await expect(page.getByText("Page 1 of 2")).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(10);
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(2);
});
