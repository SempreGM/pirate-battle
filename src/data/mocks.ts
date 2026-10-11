import { http, HttpResponse, delay } from "msw";
import { setupWorker } from "msw/browser";
import {
  canonicalConfig,
  configFor,
  DEFAULT_OPTIONS,
  RULES_VERSION,
  validOptions,
} from "../game/config";
import type { MatchRecord, Page } from "./contracts";
import { read, write, type Player } from "./storage";
export const SCENARIOS = [
  "success",
  "empty",
  "multiple-pages",
  "slow",
  "variable-latency",
  "out-of-order",
  "timeout",
  "connection-failure",
  "http-400",
  "http-500",
  "ranking-failure",
  "history-failure",
  "post-commit-timeout",
  "outage",
] as const;
export type Scenario = (typeof SCENARIOS)[number];
let scenario: Scenario = read<Scenario>("scenario", "success");
let requestCounter = 0;
export function getScenario() {
  return scenario;
}
export function setScenario(next: Scenario) {
  scenario = next;
  requestCounter = 0;
  write("scenario", next);
}
const fixtureNames = [
  "Blackbeard",
  "Anne Bonny",
  "Calico Jack",
  "Mary Read",
  "Bartholomew",
  "Sea Wolf",
  "Silver",
  "Redbeard",
  "Morgan",
  "Avery",
  "Drake",
  "Grace",
];
export function fixtures(): MatchRecord[] {
  return Array.from({ length: 32 }, (_, i) => ({
    id: `fixture-${String(i).padStart(2, "0")}`,
    playerId: `fixture-player-${i}`,
    playerName: fixtureNames[i % fixtureNames.length],
    completedAt: new Date(Date.UTC(2026, 0, 1, 12, i)).toISOString(),
    score: 48 - i,
    duration: 120,
    reason: "time_expired",
    config: configFor(DEFAULT_OPTIONS),
    rulesVersion: RULES_VERSION,
  }));
}
function records(): MatchRecord[] {
  return read<MatchRecord[]>("confirmed", []);
}
function demoHistory(current: Scenario): MatchRecord[] {
  const player = read<Player | null>("player", null);
  if (current !== "multiple-pages" || !player) return [];
  return fixtures()
    .slice(0, 12)
    .map((record, i) => ({
      ...record,
      id: `demo-history-${i}`,
      playerId: player.id,
      playerName: player.name,
    }));
}
const allRecords = (current: Scenario) => [
  ...(current === "empty" ? [] : fixtures()),
  ...demoHistory(current),
  ...records(),
];
async function fault(
  endpoint: "ranking" | "history" | "submit",
  current: Scenario,
) {
  const counter = ++requestCounter;
  if (current === "slow") await delay(1800);
  else if (current === "variable-latency")
    await delay(150 + ((counter * 731) % 1400));
  else if (current === "out-of-order") await delay(counter % 2 ? 1500 : 100);
  else await delay(200);
  if (current === "timeout") {
    await delay(4000);
    return HttpResponse.error();
  }
  if (current === "connection-failure") return HttpResponse.error();
  if (
    current === "outage" ||
    current === "http-500" ||
    current === `${endpoint}-failure`
  )
    return HttpResponse.json(
      { message: "The harbor service is temporarily unavailable." },
      { status: 503 },
    );
  if (current === "http-400")
    return HttpResponse.json(
      { message: "Demo validation failure. Select Success and retry." },
      { status: 400 },
    );
  return null;
}
function page<T>(items: T[], url: URL): Page<T> {
  const index = Math.max(1, Number(url.searchParams.get("page")) || 1),
    pageSize = 10;
  return {
    items: items.slice((index - 1) * pageSize, index * pageSize),
    total: items.length,
    page: index,
    pageSize,
  };
}
function validRecord(value: unknown): value is MatchRecord {
  if (!value || typeof value !== "object") return false;
  const r = value as MatchRecord;
  return (
    typeof r.id === "string" &&
    typeof r.playerId === "string" &&
    typeof r.playerName === "string" &&
    Number.isInteger(r.score) &&
    r.score >= 0 &&
    Number.isFinite(r.duration) &&
    r.duration >= 0 &&
    (r.reason === "time_expired" || r.reason === "player_destroyed") &&
    typeof r.completedAt === "string" &&
    Number.isFinite(Date.parse(r.completedAt)) &&
    validOptions(r.config) &&
    r.duration <= r.config.sessionSeconds &&
    canonicalConfig(r.config) === canonicalConfig(configFor(r.config)) &&
    r.rulesVersion === RULES_VERSION
  );
}
export const handlers = [
  http.get("/api/ranking", async ({ request }) => {
    const current = scenario,
      error = await fault("ranking", current);
    if (error) return error;
    const url = new URL(request.url),
      config = url.searchParams.get("config"),
      version = url.searchParams.get("version");
    const items = allRecords(current)
      .filter(
        (r) =>
          canonicalConfig(r.config) === config && r.rulesVersion === version,
      )
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.completedAt.localeCompare(b.completedAt) ||
          a.id.localeCompare(b.id),
      );
    return HttpResponse.json(page(items, url));
  }),
  http.get("/api/history", async ({ request }) => {
    const current = scenario,
      error = await fault("history", current);
    if (error) return error;
    const url = new URL(request.url);
    const items = allRecords(current)
      .filter((r) => r.playerId === url.searchParams.get("playerId"))
      .sort(
        (a, b) =>
          b.completedAt.localeCompare(a.completedAt) ||
          a.id.localeCompare(b.id),
      );
    return HttpResponse.json(page(items, url));
  }),
  http.post("/api/matches", async ({ request }) => {
    const current = scenario,
      error = await fault("submit", current);
    if (error) return error;
    const body: unknown = await request.json();
    if (!validRecord(body))
      return HttpResponse.json(
        { message: "Invalid match payload." },
        { status: 422 },
      );
    const existing = records().find((r) => r.id === body.id);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(body))
        return HttpResponse.json(
          { message: "This match ID already has a different result." },
          { status: 409 },
        );
      return HttpResponse.json(existing);
    }
    write("confirmed", [...records(), body]);
    if (current === "post-commit-timeout") {
      await delay(4000);
      return HttpResponse.error();
    }
    return HttpResponse.json(body, { status: 201 });
  }),
];
export const worker = setupWorker(...handlers);
export function resetDemo() {
  write("confirmed", []);
  write("queue", []);
  write("last-result", null);
  write("screen", "menu");
  setScenario("success");
}
