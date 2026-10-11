import type { GameConfig } from "./config";
export type Phase = "ready" | "running" | "paused" | "completed" | "abandoned";
export type Action =
  "forward" | "left" | "right" | "front" | "port" | "starboard";
export interface Circle {
  x: number;
  y: number;
  radius: number;
}
export interface Ship extends Circle {
  id: number;
  angle: number;
  health: number;
  maxHealth: number;
  kind: "player" | "chaser" | "shooter";
  cooldown: number;
  born: number;
}
export interface Projectile extends Circle {
  id: number;
  angle: number;
  owner: "player" | "enemy";
  damage: number;
  life: number;
}
export interface Effect {
  x: number;
  y: number;
  age: number;
  kind: "fire" | "hit" | "explosion";
}
export interface Snapshot {
  phase: Phase;
  score: number;
  remaining: number;
  health: number;
  elapsed: number;
  enemies: number;
}
export interface GameEvent {
  type: "fire" | "broadside" | "hit" | "explosion" | "score";
  x: number;
  y: number;
}
export const ISLANDS: Circle[] = [
  { x: 260, y: 220, radius: 100 },
  { x: 950, y: 555, radius: 105 },
  { x: 660, y: 155, radius: 65 },
];
const distance = (a: Circle, b: Circle) => Math.hypot(a.x - b.x, a.y - b.y);
const turn = (angle: number, target: number, amount: number) =>
  angle +
  Math.max(
    -amount,
    Math.min(
      amount,
      Math.atan2(Math.sin(target - angle), Math.cos(target - angle)),
    ),
  );
export function segmentCircle(
  x: number,
  y: number,
  dx: number,
  dy: number,
  circle: Circle,
  radius = 0,
): number | null {
  const ox = x - circle.x,
    oy = y - circle.y,
    r = circle.radius + radius;
  const c = ox * ox + oy * oy - r * r;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (a === 0) return null;
  const b = 2 * (ox * dx + oy * dy),
    d = b * b - 4 * a * c;
  if (d < 0) return null;
  const t = (-b - Math.sqrt(d)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}
export class Simulation {
  readonly config: Readonly<GameConfig>;
  readonly input = new Set<Action>();
  phase: Phase = "ready";
  player: Ship;
  enemies: Ship[] = [];
  projectiles: Projectile[] = [];
  effects: Effect[] = [];
  score = 0;
  elapsed = 0;
  reason: "time_expired" | "player_destroyed" | null = null;
  private accumulator = 0;
  private nextSpawn: number;
  private spawnIndex = 0;
  private nextId = 1;
  private randomState: number;
  private cooldowns = { front: 0, port: 0, starboard: 0 };
  onEvent?: (event: GameEvent) => void;
  constructor(config: Readonly<GameConfig>, seed: number) {
    this.config = Object.freeze({ ...config });
    this.randomState = seed >>> 0;
    this.nextSpawn = config.spawnSeconds;
    this.player = {
      id: 0,
      x: 600,
      y: 440,
      radius: config.playerRadius,
      angle: -Math.PI / 2,
      health: config.playerHealth,
      maxHealth: config.playerHealth,
      kind: "player",
      cooldown: 0,
      born: 0,
    };
  }
  start() {
    if (this.phase === "ready") this.phase = "running";
  }
  pause() {
    if (this.phase === "running") {
      this.phase = "paused";
      this.clearInput();
      this.accumulator = 0;
    }
  }
  resume() {
    if (this.phase === "paused") {
      this.clearInput();
      this.accumulator = 0;
      this.phase = "running";
    }
  }
  abandon() {
    if (this.phase !== "completed") this.phase = "abandoned";
    this.clearInput();
  }
  clearInput() {
    this.input.clear();
  }
  snapshot(): Snapshot {
    return {
      phase: this.phase,
      score: this.score,
      remaining: Math.max(0, this.config.sessionSeconds - this.elapsed),
      health: this.player.health,
      elapsed: this.elapsed,
      enemies: this.enemies.length,
    };
  }
  private random() {
    this.randomState += 0x6d2b79f5;
    let t = this.randomState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  advance(seconds: number) {
    if (this.phase !== "running") return;
    this.accumulator += Math.max(0, seconds);
    const step = 1 / 120;
    while (this.accumulator + 1e-10 >= step && this.phase === "running") {
      this.accumulator -= step;
      this.update(Math.min(step, this.config.sessionSeconds - this.elapsed));
    }
  }
  private free(body: Circle, ships = false) {
    const c = this.config;
    return (
      body.x >= body.radius &&
      body.y >= body.radius &&
      body.x <= c.worldWidth - body.radius &&
      body.y <= c.worldHeight - body.radius &&
      ISLANDS.every((i) => distance(body, i) >= body.radius + i.radius) &&
      (!ships ||
        [this.player, ...this.enemies].every(
          (s) => distance(body, s) > body.radius + s.radius,
        ))
    );
  }
  private move(ship: Ship, speed: number, dt: number) {
    const candidate = {
      ...ship,
      x: ship.x + Math.cos(ship.angle) * speed * dt,
      y: ship.y + Math.sin(ship.angle) * speed * dt,
    };
    if (this.free(candidate)) {
      ship.x = candidate.x;
      ship.y = candidate.y;
    }
  }
  private steering(ship: Ship, dt: number) {
    const c = this.config,
      speed = ship.kind === "chaser" ? c.chaserSpeed : c.shooterSpeed;
    let target = Math.atan2(this.player.y - ship.y, this.player.x - ship.x);
    const look = speed * 0.8 + ship.radius;
    const obstacle = ISLANDS.find(
      (i) =>
        segmentCircle(
          ship.x,
          ship.y,
          Math.cos(target) * look,
          Math.sin(target) * look,
          i,
          ship.radius + 8,
        ) !== null,
    );
    if (obstacle) {
      const obstacleAngle = Math.atan2(
        obstacle.y - ship.y,
        obstacle.x - ship.x,
      );
      const side = Math.sin(target - obstacleAngle) >= 0 ? 1 : -1;
      target = obstacleAngle + (side * Math.PI) / 2;
    }
    ship.angle = turn(
      ship.angle,
      target,
      dt * (ship.kind === "chaser" ? c.chaserRotation : c.shooterRotation),
    );
    if (ship.kind === "chaser" || distance(ship, this.player) > c.shooterRange)
      this.move(ship, speed, dt);
  }
  private emit(kind: GameEvent["type"], x: number, y: number) {
    if (kind !== "score")
      this.effects.push({
        x,
        y,
        age: 0,
        kind:
          kind === "explosion" ? "explosion" : kind === "hit" ? "hit" : "fire",
      });
    this.onEvent?.({ type: kind, x, y });
  }
  private shoot(ship: Ship, angle: number, offset = 0) {
    const c = this.config;
    const x =
      ship.x +
      Math.cos(ship.angle) * offset +
      Math.cos(angle) * (ship.radius + 6);
    const y =
      ship.y +
      Math.sin(ship.angle) * offset +
      Math.sin(angle) * (ship.radius + 6);
    this.projectiles.push({
      id: this.nextId++,
      x,
      y,
      radius: c.projectileRadius,
      angle,
      owner: ship.kind === "player" ? "player" : "enemy",
      damage: ship.kind === "player" ? c.playerDamage : c.enemyDamage,
      life: c.projectileLifetime,
    });
    this.emit("fire", x, y);
  }
  private spawn() {
    const c = this.config,
      kind = this.spawnIndex % 2 === 0 ? "chaser" : "shooter";
    for (let i = 0; i < c.spawnAttempts; i++) {
      const point = {
        x: c.enemyRadius + this.random() * (c.worldWidth - 2 * c.enemyRadius),
        y: c.enemyRadius + this.random() * (c.worldHeight - 2 * c.enemyRadius),
        radius: c.enemyRadius,
      };
      if (
        !this.free(point, true) ||
        distance(point, this.player) < c.safeSpawnDistance
      )
        continue;
      const health = kind === "chaser" ? c.chaserHealth : c.shooterHealth;
      this.enemies.push({
        ...point,
        id: this.nextId++,
        kind,
        angle: Math.atan2(this.player.y - point.y, this.player.x - point.x),
        health,
        maxHealth: health,
        cooldown: c.shooterCooldown,
        born: this.elapsed,
      });
      this.spawnIndex++;
      return;
    }
  }
  private update(dt: number) {
    const c = this.config,
      p = this.player;
    this.elapsed = Math.min(c.sessionSeconds, this.elapsed + dt);
    p.angle +=
      ((this.input.has("right") ? 1 : 0) - (this.input.has("left") ? 1 : 0)) *
      c.playerRotation *
      dt;
    if (this.input.has("forward")) this.move(p, c.playerSpeed, dt);
    for (const weapon of ["front", "port", "starboard"] as const) {
      this.cooldowns[weapon] = Math.max(0, this.cooldowns[weapon] - dt);
      if (this.input.has(weapon) && this.cooldowns[weapon] <= 1e-9) {
        if (weapon === "front") this.shoot(p, p.angle);
        else {
          const angle = p.angle + ((weapon === "port" ? -1 : 1) * Math.PI) / 2;
          for (const offset of [-16, 0, 16]) this.shoot(p, angle, offset);
          this.onEvent?.({ type: "broadside", x: p.x, y: p.y });
        }
        this.cooldowns[weapon] =
          weapon === "front" ? c.frontCooldown : c.sideCooldown;
      }
    }
    for (const enemy of this.enemies) {
      this.steering(enemy, dt);
      enemy.cooldown -= dt;
      if (
        enemy.kind === "shooter" &&
        enemy.cooldown <= 0 &&
        distance(enemy, p) <= c.shooterRange &&
        this.elapsed > enemy.born
      ) {
        this.shoot(enemy, enemy.angle);
        enemy.cooldown = c.shooterCooldown;
      }
    }
    this.projectiles = this.projectiles.filter((projectile) => {
      const travel = Math.min(dt, projectile.life),
        dx = Math.cos(projectile.angle) * c.projectileSpeed * travel,
        dy = Math.sin(projectile.angle) * c.projectileSpeed * travel;
      const hits: {
        time: number;
        obstacle: boolean;
        target?: Ship;
        id: number;
      }[] = [];
      ISLANDS.forEach((island, id) => {
        const time = segmentCircle(
          projectile.x,
          projectile.y,
          dx,
          dy,
          island,
          projectile.radius,
        );
        if (time !== null) hits.push({ time, obstacle: true, id });
      });
      const targets = projectile.owner === "player" ? this.enemies : [p];
      for (const target of targets) {
        if (target.health <= 0) continue;
        const time = segmentCircle(
          projectile.x,
          projectile.y,
          dx,
          dy,
          target,
          projectile.radius,
        );
        if (time !== null)
          hits.push({ time, obstacle: false, target, id: target.id });
      }
      hits.sort(
        (a, b) =>
          a.time - b.time ||
          Number(b.obstacle) - Number(a.obstacle) ||
          a.id - b.id,
      );
      const hit = hits[0];
      if (hit) {
        this.emit(
          "hit",
          projectile.x + dx * hit.time,
          projectile.y + dy * hit.time,
        );
        if (hit.target) {
          hit.target.health = Math.max(
            0,
            hit.target.health - projectile.damage,
          );
          if (hit.target.health === 0 && hit.target.kind !== "player") {
            this.score++;
            this.emit("explosion", hit.target.x, hit.target.y);
            this.emit("score", hit.target.x, hit.target.y);
          }
        }
        return false;
      }
      projectile.x += dx;
      projectile.y += dy;
      projectile.life -= dt;
      return (
        projectile.life > 0 &&
        projectile.x >= 0 &&
        projectile.y >= 0 &&
        projectile.x <= c.worldWidth &&
        projectile.y <= c.worldHeight
      );
    });
    for (const enemy of this.enemies) {
      if (
        enemy.health > 0 &&
        enemy.kind === "chaser" &&
        this.elapsed > enemy.born &&
        p.health > 0 &&
        distance(enemy, p) <= enemy.radius + p.radius
      ) {
        p.health = Math.max(0, p.health - c.chaserDamage);
        enemy.health = 0;
        this.emit("explosion", enemy.x, enemy.y);
      }
    }
    this.enemies = this.enemies.filter((enemy) => enemy.health > 0);
    this.effects.forEach((e) => (e.age += dt));
    this.effects = this.effects.filter((e) => e.age < 0.5);
    if (p.health <= 0 || this.elapsed >= c.sessionSeconds - 1e-8) {
      this.reason = p.health <= 0 ? "player_destroyed" : "time_expired";
      if (this.reason === "time_expired") this.elapsed = c.sessionSeconds;
      this.phase = "completed";
      this.clearInput();
      return;
    }
    if (this.elapsed + 1e-9 >= this.nextSpawn) {
      this.spawn();
      this.nextSpawn += c.spawnSeconds;
    }
  }
}
