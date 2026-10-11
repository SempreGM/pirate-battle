import { DEFAULT_OPTIONS, validOptions, type Options } from "../game/config";
export const PREFIX = "pirate-battle:";
export function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function write(key: string, value: unknown): void {
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
}
export function loadOptions(): Options {
  const saved = read<unknown>("options", null);
  return validOptions(saved) ? saved : { ...DEFAULT_OPTIONS };
}
export interface Player {
  id: string;
  name: string;
}
export function loadPlayer(): Player {
  const stored = read<Player | null>("player", null);
  if (stored && typeof stored.id === "string" && stored.name === "Captain")
    return stored;
  const player = { id: crypto.randomUUID(), name: "Captain" };
  try {
    write("player", player);
  } catch {
    /* Temporary identity keeps local combat usable. */
  }
  return player;
}
