import { test, expect } from "@playwright/test";
import { configFor, DEFAULT_OPTIONS } from "../src/game/config";
import { Simulation, segmentCircle } from "../src/game/simulation";
test("swept collisions detect crossed objects and reject paths behind them", () => {
  expect(
    segmentCircle(0, 0, 1000, 0, { x: 500, y: 0, radius: 20 }, 4),
  ).toBeCloseTo(0.476);
  expect(
    segmentCircle(0, 0, -1000, 0, { x: 500, y: 0, radius: 20 }, 4),
  ).toBeNull();
});
test("same seed and inputs produce equivalent results at different frame rates", () => {
  const config = configFor(DEFAULT_OPTIONS),
    a = new Simulation(config, 42),
    b = new Simulation(config, 42);
  for (const sim of [a, b]) {
    sim.start();
    sim.input.add("forward");
    sim.input.add("front");
  }
  for (let i = 0; i < 360; i++) a.advance(1 / 60);
  for (let i = 0; i < 180; i++) b.advance(1 / 30);
  expect(a.snapshot()).toEqual(b.snapshot());
  expect(a.player).toEqual(b.player);
  expect(a.enemies).toEqual(b.enemies);
});
test("perimeter route survives a full session without changing simulation rules", () => {
  const sim = new Simulation(
    configFor({ sessionSeconds: 180, spawnSeconds: 10 }),
    3,
  );
  sim.start();
  const waypoints = [
    [600, 710],
    [50, 710],
    [50, 50],
    [1150, 50],
    [1150, 710],
  ];
  let target = 0;
  for (let i = 0; i < 4000 && sim.phase === "running"; i++) {
    const [x, y] = waypoints[target];
    if (Math.hypot(x - sim.player.x, y - sim.player.y) < 35)
      target = (target + 1) % waypoints.length;
    const angle = Math.atan2(
        waypoints[target][1] - sim.player.y,
        waypoints[target][0] - sim.player.x,
      ),
      delta = Math.atan2(
        Math.sin(angle - sim.player.angle),
        Math.cos(angle - sim.player.angle),
      );
    sim.clearInput();
    sim.input.add("front");
    sim.input.add("port");
    sim.input.add("starboard");
    if (Math.abs(delta) > 0.08) sim.input.add(delta > 0 ? "right" : "left");
    if (Math.abs(delta) < 0.5) sim.input.add("forward");
    sim.advance(
      Math.min(
        0.1,
        Math.abs(delta) > 0.08
          ? Math.abs(delta) / sim.config.playerRotation
          : 0.1,
      ),
    );
  }
  expect(sim.player.health).toBeGreaterThan(0);
  expect(sim.reason).toBe("time_expired");
  const completed = sim.snapshot();
  sim.advance(20);
  expect(sim.snapshot()).toEqual(completed);
});
