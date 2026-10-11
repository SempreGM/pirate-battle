import axios from "axios";
import { QueryClient } from "@tanstack/react-query";
import {
  canonicalConfig,
  RULES_VERSION,
  type GameConfig,
} from "../game/config";
import type { MatchRecord, Page } from "./contracts";
export const api = axios.create({ baseURL: "/api", timeout: 2500 });
export function canRetry(count: number, error: unknown) {
  return (
    count < 2 &&
    (!axios.isAxiosError(error) ||
      !error.response ||
      error.response.status >= 500)
  );
}
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10000,
      retry: canRetry,
      retryDelay: (attempt) => Math.min(300 * 2 ** attempt, 1200),
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: canRetry,
      retryDelay: (attempt) => Math.min(300 * 2 ** attempt, 1200),
    },
  },
});
export async function getRanking(
  config: Readonly<GameConfig>,
  page: number,
  signal: AbortSignal,
) {
  return (
    await api.get<Page<MatchRecord>>("/ranking", {
      params: { config: canonicalConfig(config), version: RULES_VERSION, page },
      signal,
    })
  ).data;
}
export async function getHistory(
  playerId: string,
  page: number,
  signal: AbortSignal,
) {
  return (
    await api.get<Page<MatchRecord>>("/history", {
      params: { playerId, page },
      signal,
    })
  ).data;
}
export async function postMatch(record: MatchRecord) {
  return (await api.post<MatchRecord>("/matches", record)).data;
}
export function errorMessage(error: unknown) {
  return axios.isAxiosError(error)
    ? ((error.response?.data?.message as string | undefined) ??
        (error.code === "ECONNABORTED"
          ? "The request timed out. Your result is saved; retry safely."
          : "Unable to contact the harbor. Try again."))
    : "An unexpected error occurred.";
}
