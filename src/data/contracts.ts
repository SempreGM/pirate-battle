import type { GameConfig } from "../game/config";
export interface MatchRecord {
  id: string;
  playerId: string;
  playerName: string;
  completedAt: string;
  score: number;
  duration: number;
  reason: "time_expired" | "player_destroyed";
  config: Readonly<GameConfig>;
  rulesVersion: string;
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export type SubmissionState = "pending" | "submitting" | "confirmed" | "failed";
