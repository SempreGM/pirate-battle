export const RULES_VERSION = "1.0.0";
export interface Options {
  sessionSeconds: number;
  spawnSeconds: number;
}
export interface GameConfig extends Options {
  worldWidth: number;
  worldHeight: number;
  playerHealth: number;
  playerSpeed: number;
  playerRotation: number;
  playerRadius: number;
  chaserHealth: number;
  chaserSpeed: number;
  chaserRotation: number;
  chaserDamage: number;
  enemyRadius: number;
  shooterHealth: number;
  shooterSpeed: number;
  shooterRotation: number;
  shooterRange: number;
  shooterCooldown: number;
  playerDamage: number;
  enemyDamage: number;
  projectileSpeed: number;
  projectileLifetime: number;
  projectileRadius: number;
  frontCooldown: number;
  sideCooldown: number;
  safeSpawnDistance: number;
  spawnAttempts: number;
  enemyDistribution: "alternating";
}
export const DEFAULT_OPTIONS: Options = {
  sessionSeconds: 120,
  spawnSeconds: 3,
};
export const BALANCE: GameConfig = {
  ...DEFAULT_OPTIONS,
  worldWidth: 1200,
  worldHeight: 760,
  playerHealth: 100,
  playerSpeed: 170,
  playerRotation: 2.6,
  playerRadius: 22,
  chaserHealth: 30,
  chaserSpeed: 105,
  chaserRotation: 2.3,
  chaserDamage: 25,
  enemyRadius: 21,
  shooterHealth: 50,
  shooterSpeed: 75,
  shooterRotation: 1.8,
  shooterRange: 330,
  shooterCooldown: 1.5,
  playerDamage: 10,
  enemyDamage: 10,
  projectileSpeed: 480,
  projectileLifetime: 1.8,
  projectileRadius: 4,
  frontCooldown: 0.3,
  sideCooldown: 1,
  safeSpawnDistance: 340,
  spawnAttempts: 48,
  enemyDistribution: "alternating",
};
export function validOptions(value: unknown): value is Options {
  if (!value || typeof value !== "object") return false;
  const o = value as Options;
  return (
    Number.isInteger(o.sessionSeconds) &&
    o.sessionSeconds >= 60 &&
    o.sessionSeconds <= 180 &&
    Number.isInteger(o.spawnSeconds) &&
    o.spawnSeconds >= 1 &&
    o.spawnSeconds <= 10
  );
}
export const configFor = (options: Options): Readonly<GameConfig> =>
  Object.freeze({ ...BALANCE, ...options });
export function canonicalConfig(config: Readonly<GameConfig>): string {
  return JSON.stringify(
    Object.entries(config).sort(([a], [b]) => a.localeCompare(b)),
  );
}
