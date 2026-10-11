import {
  Application,
  Assets,
  Container,
  Graphics,
  Sprite,
  Texture,
  Rectangle,
  TilingSprite,
} from "pixi.js";
import { ISLANDS, type Ship, type Simulation } from "./simulation";
export const REQUIRED_ASSETS = {
  player: "/assets/png/retina/ships/ship_1.png",
  chaser: "/assets/png/retina/ships/ship_7.png",
  shooter: "/assets/png/retina/ships/ship_13.png",
  cannonball: "/assets/png/retina/ship_parts/cannon_ball.png",
  explosion: "/assets/png/retina/effects/explosion_1.png",
  fire: "/assets/png/retina/effects/fire_1.png",
  tiles: "/assets/tilesheet/tiles_sheet.png",
};
let loading: Promise<Record<string, Texture>> | null = null;
export function loadTextures(
  progress: (value: number) => void,
): Promise<Record<string, Texture>> {
  if (!loading)
    loading = (async () => {
      const entries = Object.entries(REQUIRED_ASSETS);
      let done = 0;
      const textures = await Promise.all(
        entries.map(async ([key, path]) => {
          const texture = await Assets.load<Texture>(path);
          progress(++done / entries.length);
          return [key, texture] as const;
        }),
      );
      return Object.fromEntries(textures);
    })().catch((error) => {
      loading = null;
      throw error;
    });
  return loading.then((result) => {
    progress(1);
    return result;
  });
}
export class GameRenderer {
  readonly app = new Application();
  private world = new Container();
  private actors = new Container();
  private effects = new Container();
  private ships = new Map<
    number,
    { root: Container; sprite: Sprite; health: Graphics }
  >();
  private bullets = new Map<number, Sprite>();
  private observer?: ResizeObserver;
  private destroyed = false;
  async init(
    host: HTMLElement,
    privateTextures: Record<string, Texture>,
    sim: Simulation,
  ): Promise<boolean> {
    await this.app.init({
      background: "#2599af",
      antialias: true,
      resolution: Math.min(devicePixelRatio || 1, 2),
      autoDensity: true,
      preference: "webgl",
    });
    if (this.destroyed) {
      this.app.destroy(true);
      return false;
    }
    host.appendChild(this.app.canvas);
    this.app.canvas.setAttribute("aria-label", "Naval combat arena");
    this.app.canvas.setAttribute("role", "img");
    this.app.stage.addChild(this.world);
    const tiles = privateTextures.tiles;
    const waterTexture = new Texture({
      source: tiles.source,
      frame: new Rectangle(512, 256, 64, 64),
    });
    this.world.addChild(
      new TilingSprite({
        texture: waterTexture,
        width: sim.config.worldWidth,
        height: sim.config.worldHeight,
      }),
    );
    for (const island of ISLANDS) {
      const sand = new Graphics()
        .circle(island.x + 5, island.y + 8, island.radius + 13)
        .fill({ color: 0x156575, alpha: 0.3 })
        .circle(island.x, island.y, island.radius)
        .fill(0xe9cb8b)
        .circle(island.x, island.y, island.radius * 0.79)
        .fill(0x70a63e);
      this.world.addChild(sand);
      const terrain = new Sprite(
        new Texture({
          source: tiles.source,
          frame: new Rectangle(320, 0, 256, 256),
        }),
      );
      terrain.anchor.set(0.5);
      terrain.position.set(island.x, island.y);
      terrain.width = terrain.height = island.radius * 2;
      const mask = new Graphics()
        .circle(island.x, island.y, island.radius)
        .fill(0xffffff);
      terrain.mask = mask;
      this.world.addChild(terrain, mask);
      const tree = new Sprite(
        new Texture({
          source: tiles.source,
          frame: new Rectangle(384, 256, 64, 64),
        }),
      );
      tree.anchor.set(0.5);
      tree.position.set(
        island.x - island.radius * 0.2,
        island.y + island.radius * 0.15,
      );
      tree.scale.set(1.3);
      this.world.addChild(tree);
    }
    this.world.addChild(this.actors, this.effects);
    const resize = () => {
      const width = Math.max(1, host.clientWidth),
        height = Math.max(1, host.clientHeight);
      this.app.renderer.resize(width, height);
      const scale = Math.min(
        width / sim.config.worldWidth,
        height / sim.config.worldHeight,
      );
      this.world.scale.set(scale);
      this.world.position.set(
        (width - sim.config.worldWidth * scale) / 2,
        (height - sim.config.worldHeight * scale) / 2,
      );
    };
    this.observer = new ResizeObserver(resize);
    this.observer.observe(host);
    resize();
    this.render(sim, privateTextures);
    return true;
  }
  render(sim: Simulation, textures: Record<string, Texture>) {
    const alive = new Set<number>();
    for (const ship of [sim.player, ...sim.enemies]) {
      alive.add(ship.id);
      let display = this.ships.get(ship.id);
      if (!display) {
        const root = new Container(),
          sprite = new Sprite(textures[ship.kind]),
          health = new Graphics();
        sprite.anchor.set(0.5);
        sprite.width = ship.kind === "player" ? 51 : 46;
        sprite.height = ship.kind === "player" ? 76 : 68;
        root.addChild(sprite, health);
        this.actors.addChild(root);
        display = { root, sprite, health };
        this.ships.set(ship.id, display);
      }
      this.drawShip(ship, display);
    }
    for (const [id, display] of this.ships)
      if (!alive.has(id)) {
        display.root.destroy({ children: true });
        this.ships.delete(id);
      }
    const bulletIds = new Set<number>();
    for (const projectile of sim.projectiles) {
      bulletIds.add(projectile.id);
      let sprite = this.bullets.get(projectile.id);
      if (!sprite) {
        sprite = new Sprite(textures.cannonball);
        sprite.anchor.set(0.5);
        sprite.width = sprite.height = 10;
        this.actors.addChild(sprite);
        this.bullets.set(projectile.id, sprite);
      }
      sprite.position.set(projectile.x, projectile.y);
      sprite.tint = projectile.owner === "player" ? 0xffffff : 0xffbe8e;
    }
    for (const [id, sprite] of this.bullets)
      if (!bulletIds.has(id)) {
        sprite.destroy();
        this.bullets.delete(id);
      }
    this.effects.removeChildren().forEach((child) => child.destroy());
    for (const effect of sim.effects) {
      const sprite = new Sprite(
        textures[effect.kind === "explosion" ? "explosion" : "fire"],
      );
      sprite.anchor.set(0.5);
      sprite.position.set(effect.x, effect.y);
      const size = effect.kind === "explosion" ? 64 : 22;
      sprite.width = sprite.height = size * (1 + effect.age);
      sprite.alpha = 1 - effect.age * 2;
      this.effects.addChild(sprite);
    }
  }
  private drawShip(
    ship: Ship,
    display: { root: Container; sprite: Sprite; health: Graphics },
  ) {
    display.root.position.set(ship.x, ship.y);
    display.sprite.rotation = ship.angle + Math.PI / 2;
    const ratio = ship.health / ship.maxHealth;
    display.sprite.tint =
      ratio < 0.3 ? 0xb86c55 : ratio < 0.6 ? 0xc7ae86 : 0xffffff;
    display.health
      .clear()
      .roundRect(-25, -52, 50, 7, 3)
      .fill(0x17292c)
      .roundRect(-23, -50, 46 * ratio, 3, 1)
      .fill(ratio > 0.5 ? 0x73d881 : ratio > 0.25 ? 0xf4c55c : 0xf06552);
  }
  destroy() {
    this.destroyed = true;
    this.observer?.disconnect();
    if (this.app.renderer) {
      this.app.ticker.stop();
      this.app.destroy(true, { children: true });
    }
  }
}
