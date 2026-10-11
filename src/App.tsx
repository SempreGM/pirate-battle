import { useMemo, useState } from "react";
import { configFor, validOptions } from "./game/config";
import { loadOptions, loadPlayer, read, write } from "./data/storage";
import type { MatchRecord } from "./data/contracts";
import { useSubmissions } from "./data/submissions";
import {
  SCENARIOS,
  getScenario,
  setScenario,
  resetDemo,
  type Scenario,
} from "./data/mocks";
import { queryClient } from "./data/api";
import { Game } from "./ui/Game";
import { Dialog } from "./ui/Dialog";
import { Leaderboard } from "./ui/Leaderboard";
type Screen = "menu" | "game" | "result";
export default function App() {
  const [options, setOptions] = useState(loadOptions),
    [player] = useState(loadPlayer),
    [last, setLast] = useState(() =>
      read<MatchRecord | null>("last-result", null),
    );
  const [screen, setScreen] = useState<Screen>(() =>
    read<string>("screen", "menu") === "result" && read("last-result", null)
      ? "result"
      : "menu",
  );
  const [dialog, setDialog] = useState<"options" | "network" | "reset" | null>(
      null,
    ),
    [tab, setTab] = useState<"ranking" | "history">("ranking");
  const [duration, setDuration] = useState(String(options.sessionSeconds)),
    [spawn, setSpawn] = useState(String(options.spawnSeconds)),
    [message, setMessage] = useState("");
  const [scenario, selectScenario] = useState(getScenario),
    [gameNumber, setGameNumber] = useState(0);
  const config = useMemo(() => configFor(options), [options]);
  const submissions = useSubmissions();
  function navigate(next: Screen) {
    try {
      write("screen", next);
    } catch {
      setMessage(
        "Browser storage is unavailable. Changes may not survive refresh.",
      );
    }
    setScreen(next);
  }
  function play() {
    setDialog(null);
    setGameNumber((n) => n + 1);
    navigate("game");
  }
  function complete(record: MatchRecord) {
    try {
      submissions.enqueue(record);
      setMessage("");
    } catch {
      setMessage(
        "Unable to save this result in browser storage. Keep this page open.",
      );
    }
    setLast(record);
    navigate("result");
  }
  if (screen === "game")
    return (
      <Game
        key={gameNumber}
        config={config}
        player={player}
        onComplete={complete}
        onExit={() => navigate("menu")}
      />
    );
  return (
    <div className="app-shell">
      <header className="topbar">
        <a
          className="wordmark"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            navigate("menu");
          }}
        >
          PIRATE <span>BATTLE</span>
        </a>
        <span className="topbar-label">A CAPTAIN’S CHALLENGE</span>
        <button className="text-button" onClick={() => setDialog("network")}>
          Harbor status{" "}
          <span
            className={`status-dot ${scenario === "success" ? "" : "warning"}`}
          />
        </button>
      </header>
      <main className="menu-layout">
        <section className="hero-panel">
          <div className="hero-copy">
            <p className="eyebrow">THE OPEN SEA AWAITS</p>
            <img
              className="game-title"
              src="/assets/png/retina/ui/menu/title_pirate_battle.png"
              alt="Pirate Battle"
            />
            <h1>
              Set sail.
              <br />
              Take command.
            </h1>
            <p className="intro">
              Navigate the islands. Outgun your enemies.
              <br />
              Leave your mark on the high seas.
            </p>
            <div className="hero-actions">
              <button className="primary big" onClick={play}>
                Set sail <span>→</span>
              </button>
              <button
                className="secondary big"
                onClick={() => {
                  setDuration(String(options.sessionSeconds));
                  setSpawn(String(options.spawnSeconds));
                  setMessage("");
                  setDialog("options");
                }}
              >
                Options
              </button>
            </div>
            <div className="voyage-settings">
              <span>
                <strong>{options.sessionSeconds}s</strong> per voyage
              </span>
              <i />
              <span>
                <strong>{options.spawnSeconds}s</strong> enemy arrivals
              </span>
            </div>
            {last && screen === "menu" && (
              <button
                className="text-button last-result"
                onClick={() => navigate("result")}
              >
                View last result →
              </button>
            )}
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="compass">
              N<span>✦</span>S
            </div>
            <img
              className="hero-ship"
              src="/assets/png/retina/ships/ship_1.png"
            />
            <span className="map-label">UNCHARTED WATERS</span>
            <div className="coordinates">18° 24′ N &nbsp; 72° 18′ W</div>
          </div>
          <div className="hero-bottom">
            <span>⚓ SINGLE PLAYER</span>
            <span>BUILT FOR BOLD CAPTAINS</span>
          </div>
        </section>
        <aside className="log-panel">
          {screen === "result" && last ? (
            <section className="result">
              <p className="eyebrow">VOYAGE COMPLETE</p>
              <h2>
                {last.reason === "time_expired"
                  ? "You weathered the storm."
                  : "A captain goes down fighting."}
              </h2>
              <div className="result-score">
                <img src="/assets/png/default/ui/hud/icon_score.png" alt="" />
                <strong>{last.score}</strong>
                <span>ENEMIES SUNK</span>
              </div>
              <dl>
                <div>
                  <dt>Active time</dt>
                  <dd>{last.duration.toFixed(1)} seconds</dd>
                </div>
                <div>
                  <dt>Result</dt>
                  <dd>
                    {last.reason === "time_expired"
                      ? "Time expired"
                      : "Player destroyed"}
                  </dd>
                </div>
                <div>
                  <dt>Captain’s log</dt>
                  <dd role="status">{submissions.status(last.id)}</dd>
                </div>
              </dl>
              {submissions.errors[last.id] && (
                <p role="alert" className="error-message">
                  {submissions.errors[last.id]}
                </p>
              )}
              {message && <p role="alert">{message}</p>}
              {["failed", "pending"].includes(submissions.status(last.id)) && (
                <button
                  className="secondary"
                  onClick={() => submissions.submit(last)}
                >
                  Retry submission
                </button>
              )}
              <button className="primary" onClick={play}>
                Play Again
              </button>
              <button className="text-button" onClick={() => navigate("menu")}>
                Main Menu
              </button>
            </section>
          ) : (
            <>
              <div className="log-title">
                <span>THE CAPTAIN’S LOG</span>
                <img src="/assets/png/default/ui/hud/icon_score.png" alt="" />
              </div>
              <div className="tabs" role="tablist" aria-label="Captain’s log">
                <button
                  role="tab"
                  aria-selected={tab === "ranking"}
                  onClick={() => setTab("ranking")}
                >
                  Ranking
                </button>
                <button
                  role="tab"
                  aria-selected={tab === "history"}
                  onClick={() => setTab("history")}
                >
                  Match History
                </button>
              </div>
              <Leaderboard
                key={`${tab}-${options.sessionSeconds}-${options.spawnSeconds}-${scenario}`}
                tab={tab}
                playerId={player.id}
                config={config}
              />
            </>
          )}
          {submissions.pending.length > 0 && (
            <div className="pending-log" role="status">
              {submissions.pending.length} voyage(s) awaiting registration.{" "}
              <button
                className="text-button"
                onClick={() => submissions.pending.forEach(submissions.submit)}
              >
                Retry pending
              </button>
            </div>
          )}
        </aside>
      </main>
      <section className="controls-guide" aria-label="Controls">
        <div>
          <p className="eyebrow">KNOW YOUR SHIP</p>
          <h2>A little seamanship goes a long way.</h2>
        </div>
        <div className="guide-items">
          <span>
            <kbd>W</kbd>
            <kbd>↑</kbd>
            <small>Move forward</small>
          </span>
          <span>
            <kbd>A</kbd>
            <kbd>D</kbd>
            <small>Turn left / right</small>
          </span>
          <span>
            <kbd>Space</kbd>
            <small>Front cannon</small>
          </span>
          <span>
            <kbd>Q</kbd>
            <kbd>E</kbd>
            <small>Side cannons</small>
          </span>
          <span>
            <kbd>P</kbd>
            <kbd>Esc</kbd>
            <small>Pause</small>
          </span>
        </div>
        <p className="touch-note">
          On mobile? Use the on-screen ship controls.
        </p>
      </section>
      <footer className="site-footer">
        <img src="/assets/logo_jungle_gaming.svg" alt="Jungle Gaming" />
        <span>Fair winds. Fierce battles.</span>
        <span>
          Captain{" "}
          {player.name === "Captain" ? "· No login required" : player.name}
        </span>
      </footer>
      {dialog === "options" && (
        <Dialog title="Chart your voyage" onClose={() => setDialog(null)}>
          <p>Changes apply to your next voyage.</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const next = {
                sessionSeconds: Number(duration),
                spawnSeconds: Number(spawn),
              };
              if (!duration.trim() || !spawn.trim() || !validOptions(next)) {
                setMessage(
                  "Use whole numbers: session 60–180 seconds; spawn 1–10 seconds.",
                );
                return;
              }
              try {
                write("options", next);
                setOptions(next);
                setMessage("Options saved.");
              } catch {
                setMessage(
                  "Unable to save options. Check browser storage permissions.",
                );
              }
            }}
            noValidate
          >
            <label htmlFor="duration">
              Game session time <small>60–180 seconds</small>
            </label>
            <input
              autoFocus
              id="duration"
              type="number"
              min="60"
              max="180"
              step="1"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
            <label htmlFor="spawn">
              Enemy spawn time <small>1–10 seconds</small>
            </label>
            <input
              id="spawn"
              type="number"
              min="1"
              max="10"
              step="1"
              value={spawn}
              onChange={(e) => setSpawn(e.target.value)}
            />
            <p className="saved-values">
              Saved: {options.sessionSeconds}s session · {options.spawnSeconds}s
              spawn
            </p>
            {message && <p role="status">{message}</p>}
            <button type="submit">Save</button>
            <button
              type="button"
              className="secondary"
              onClick={() => setDialog(null)}
            >
              Back
            </button>
          </form>
        </Dialog>
      )}
      {dialog === "network" && (
        <Dialog title="Harbor network" onClose={() => setDialog(null)}>
          <p>
            Reproducible demo scenarios affect the captain’s log. Combat runs
            locally.
          </p>
          <label htmlFor="scenario">Network scenario</label>
          <select
            autoFocus
            id="scenario"
            value={scenario}
            onChange={(event) => {
              const next = event.target.value as Scenario;
              setScenario(next);
              selectScenario(next);
              void queryClient.cancelQueries();
              void queryClient.invalidateQueries();
            }}
          >
            {SCENARIOS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button className="secondary" onClick={() => setDialog("reset")}>
            Reset demo data
          </button>
          <button onClick={() => setDialog(null)}>Done</button>
        </Dialog>
      )}
      {dialog === "reset" && (
        <Dialog
          title="Reset the captain’s log?"
          onClose={() => setDialog("network")}
        >
          <p>
            This clears confirmed voyages, pending submissions and the last
            result, and restores demo fixtures. Your options and captain
            identity remain.
          </p>
          <button
            disabled={queryClient.isMutating() > 0}
            onClick={() => {
              resetDemo();
              queryClient.clear();
              submissions.reset();
              setLast(null);
              selectScenario("success");
              navigate("menu");
              setDialog(null);
            }}
          >
            Confirm reset
          </button>
          <button
            autoFocus
            className="secondary"
            onClick={() => setDialog("network")}
          >
            Cancel
          </button>
        </Dialog>
      )}
    </div>
  );
}
