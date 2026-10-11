import ts from "typescript";
import fs from "node:fs";
const compile = async (file) =>
  import(
    "data:text/javascript;base64," +
      Buffer.from(
        ts.transpileModule(fs.readFileSync(file, "utf8"), {
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
          },
        }).outputText,
      ).toString("base64")
  );
const { Simulation } = await compile("src/game/simulation.ts");
const { configFor } = await compile("src/game/config.ts");
for (const spawn of [3, 10])
  for (let seed = 1; seed <= 10; seed++) {
    const sim = new Simulation(
      configFor({ sessionSeconds: 180, spawnSeconds: spawn }),
      seed,
    );
    sim.start();
    const wp = [
      [600, 710],
      [50, 710],
      [50, 50],
      [1150, 50],
      [1150, 710],
    ];
    let target = 0;
    for (let i = 0; i < 4000 && sim.phase === "running"; i++) {
      if (
        Math.hypot(wp[target][0] - sim.player.x, wp[target][1] - sim.player.y) <
        35
      )
        target = (target + 1) % wp.length;
      const angle = Math.atan2(
          wp[target][1] - sim.player.y,
          wp[target][0] - sim.player.x,
        ),
        delta = Math.atan2(
          Math.sin(angle - sim.player.angle),
          Math.cos(angle - sim.player.angle),
        );
      sim.clearInput();
      for (const a of ["front", "port", "starboard"]) sim.input.add(a);
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
    console.log(
      JSON.stringify({
        spawn,
        seed,
        time: sim.elapsed,
        hp: sim.player.health,
        score: sim.score,
        reason: sim.reason,
      }),
    );
  }
