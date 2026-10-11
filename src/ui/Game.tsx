import { useEffect, useRef, useState } from "react";
import { RULES_VERSION, type GameConfig } from "../game/config";
import { Simulation, type Action, type Snapshot } from "../game/simulation";
import { GameRenderer, loadTextures } from "../game/renderer";
import { InputController } from "../game/input";
import { GameAudio } from "../game/audio";
import type { MatchRecord } from "../data/contracts";
import type { Player } from "../data/storage";
import { Dialog } from "./Dialog";
declare global {
  interface Window {
    __PIRATE_TEST__?: {
      snapshot: () => Omit<Snapshot, "enemies"> & {
        player: Simulation["player"];
        enemies: Simulation["enemies"];
        projectiles: Simulation["projectiles"];
      };
      advance: (seconds: number) => void;
      pause: () => void;
      resume: () => void;
    };
  }
  interface Window {
    __PIRATE_PROFILE__?: {
      snapshot: () => Snapshot & { x: number; y: number; angle: number };
      frames: number[];
      entities: number[];
    };
  }
}
const CONTROLS: { action: Action; label: string; icon: string; key: string }[] =
  [
    { action: "left", label: "Turn left", icon: "turn_left", key: "A" },
    { action: "forward", label: "Forward", icon: "forward", key: "W" },
    { action: "right", label: "Turn right", icon: "turn_right", key: "D" },
    { action: "port", label: "Fire left", icon: "fire_left", key: "Q" },
    { action: "front", label: "Fire front", icon: "fire_front", key: "Space" },
    { action: "starboard", label: "Fire right", icon: "fire_right", key: "E" },
  ];
export function Game({
  config,
  player,
  onComplete,
  onExit,
}: {
  config: Readonly<GameConfig>;
  player: Player;
  onComplete: (record: MatchRecord) => void;
  onExit: () => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    simRef = useRef<Simulation | null>(null),
    input = useRef<InputController | null>(null),
    audio = useRef<GameAudio | null>(null);
  const [attempt, setAttempt] = useState(0),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(""),
    [paused, setPaused] = useState(false),
    [muted, setMuted] = useState(false);
  const [hud, setHud] = useState<Snapshot>({
    phase: "ready",
    score: 0,
    remaining: config.sessionSeconds,
    health: config.playerHealth,
    elapsed: 0,
    enemies: 0,
  });
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  useEffect(() => {
    let cancelled = false,
      completed = false;
    const renderer = new GameRenderer();
    const sound = new GameAudio();
    audio.current = sound;
    const url = new URL(location.href),
      testMode = url.searchParams.get("test") === "1",
      seed =
        Number(url.searchParams.get("seed")) || Math.floor(Math.random() * 1e9);
    const sim = new Simulation(config, seed);
    simRef.current = sim;
    const matchId = crypto.randomUUID();
    const pause = () => {
      sim.pause();
      controller.clear();
      setPaused(true);
      setHud(sim.snapshot());
      sound.play("pause");
    };
    const controller = new InputController(sim, pause);
    input.current = controller;
    sim.onEvent = (event) => sound.play(event.type);
    const publish = () => {
      setHud(sim.snapshot());
      if (sim.phase === "completed" && !completed) {
        completed = true;
        controller.clear();
        sound.play("complete");
        completeRef.current({
          id: matchId,
          playerId: player.id,
          playerName: player.name,
          completedAt: new Date().toISOString(),
          score: sim.score,
          duration: sim.elapsed,
          reason: sim.reason!,
          config: sim.config,
          rulesVersion: RULES_VERSION,
        });
      }
    };
    void loadTextures((value) => {
      if (!cancelled) setProgress(value);
    })
      .then(async (textures) => {
        if (cancelled || !host.current) return;
        if (!(await renderer.init(host.current, textures, sim)) || cancelled)
          return;
        sim.start();
        publish();
        let lastPublish = 0;
        const profile =
          url.searchParams.get("profile") === "1"
            ? {
                snapshot: () => ({
                  ...sim.snapshot(),
                  x: sim.player.x,
                  y: sim.player.y,
                  angle: sim.player.angle,
                }),
                frames: [] as number[],
                entities: [] as number[],
              }
            : null;
        if (profile) window.__PIRATE_PROFILE__ = profile;
        renderer.app.ticker.add((ticker) => {
          if (!testMode) sim.advance(Math.min(ticker.deltaMS / 1000, 0.1));
          renderer.render(sim, textures);
          if (profile && sim.phase === "running") {
            profile.frames.push(ticker.elapsedMS);
            profile.entities.push(
              1 +
                sim.enemies.length +
                sim.projectiles.length +
                sim.effects.length,
            );
          }
          lastPublish += ticker.deltaMS;
          if (lastPublish >= 100 || sim.phase === "completed") {
            lastPublish = 0;
            publish();
          }
        });
        if (testMode)
          window.__PIRATE_TEST__ = {
            snapshot: () => ({
              ...sim.snapshot(),
              player: { ...sim.player },
              enemies: sim.enemies.map((e) => ({ ...e })),
              projectiles: sim.projectiles.map((p) => ({ ...p })),
            }),
            advance: (seconds) => {
              sim.advance(seconds);
              renderer.render(sim, textures);
              publish();
            },
            pause,
            resume: () => {
              controller.clear();
              sim.resume();
              setPaused(false);
              publish();
            },
          };
      })
      .catch((reason) => {
        if (!cancelled)
          setError(
            `Unable to load the arena assets. ${reason instanceof Error ? reason.message : ""}`,
          );
      });
    return () => {
      cancelled = true;
      controller.destroy();
      renderer.destroy();
      sound.destroy();
      sim.abandon();
      simRef.current = null;
      input.current = null;
      delete window.__PIRATE_TEST__;
      delete window.__PIRATE_PROFILE__;
    };
  }, [config, player, attempt]);
  const resume = () => {
    input.current?.clear();
    simRef.current?.resume();
    setPaused(false);
    audio.current?.play("resume");
  };
  const pause = () => {
    simRef.current?.pause();
    input.current?.clear();
    setPaused(true);
  };
  const minutes = Math.floor(Math.ceil(hud.remaining) / 60),
    seconds = Math.ceil(hud.remaining) % 60;
  return (
    <main className="combat-shell">
      <header className="combat-header">
        <div className="brand-mini">
          PIRATE BATTLE <span>OPEN WATERS</span>
        </div>
        <div className="hud">
          <span aria-label={`Health ${hud.health} of ${config.playerHealth}`}>
            <img src="/assets/png/default/ui/hud/icon_heart.png" alt="" />{" "}
            {hud.health}
            <small> / {config.playerHealth}</small>
          </span>
          <span aria-label={`Score ${hud.score}`}>
            <img src="/assets/png/default/ui/hud/icon_score.png" alt="" />{" "}
            {hud.score}
          </span>
          <span
            aria-label={`Time remaining ${Math.ceil(hud.remaining)} seconds`}
          >
            <img src="/assets/png/default/ui/hud/icon_time.png" alt="" />{" "}
            {minutes}:{String(seconds).padStart(2, "0")}
          </span>
        </div>
        <button
          className="icon-button"
          onClick={pause}
          disabled={progress < 1 || !!error}
          aria-label="Pause"
        >
          Ⅱ
        </button>
      </header>
      <div className="arena-frame">
        <div className="arena" ref={host} />
        {progress < 1 && !error && (
          <div className="loading-overlay" role="status">
            <div className="loading-card">
              <h2>Preparing your ship</h2>
              <progress max={1} value={progress} />
              <p>Loading the open waters… {Math.round(progress * 100)}%</p>
            </div>
          </div>
        )}
        {error && (
          <div className="loading-overlay">
            <div className="loading-card">
              <p role="alert">{error}</p>
              <button
                onClick={() => {
                  setError("");
                  setProgress(0);
                  setAttempt((x) => x + 1);
                }}
              >
                Retry assets
              </button>
              <button className="secondary" onClick={onExit}>
                Main Menu
              </button>
            </div>
          </div>
        )}
      </div>
      <footer className="combat-footer">
        <div className="touch-controls">
          {CONTROLS.map((control) => (
            <button
              key={control.action}
              className="control-button"
              aria-label={control.label}
              disabled={hud.phase !== "running"}
              onPointerDown={(event) => {
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                input.current?.press(event.pointerId, control.action);
              }}
              onPointerUp={(event) => input.current?.release(event.pointerId)}
              onPointerCancel={(event) =>
                input.current?.release(event.pointerId)
              }
              onLostPointerCapture={(event) =>
                input.current?.release(event.pointerId)
              }
              onKeyDown={(event) => {
                if (event.code === "Enter")
                  input.current?.press(
                    -CONTROLS.indexOf(control) - 1,
                    control.action,
                  );
              }}
              onKeyUp={() =>
                input.current?.release(-CONTROLS.indexOf(control) - 1)
              }
            >
              <img
                src={`/assets/png/default/ui/controls/icon_${control.icon}.png`}
                alt=""
              />
              <span>{control.key}</span>
            </button>
          ))}
        </div>
        <span className="battle-status">
          {paused
            ? "Paused"
            : hud.phase === "running"
              ? "Stay afloat. Make every shot count."
              : "Preparing arena"}
        </span>
        <button
          className="text-button"
          onClick={() => {
            setMuted((value) => !value);
            if (audio.current) audio.current.muted = !muted;
          }}
        >
          {muted ? "Sound off" : "Sound on"}
        </button>
      </footer>
      {paused && (
        <Dialog title="At anchor" onClose={resume}>
          <p>The battle is paused. Your time is safe.</p>
          <button autoFocus onClick={resume}>
            Resume
          </button>
          <button className="secondary" onClick={onExit}>
            Main Menu
          </button>
        </Dialog>
      )}
    </main>
  );
}
