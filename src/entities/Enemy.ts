import Phaser from 'phaser';
import { DEPTH } from '../config/constants';
import type { EnemyDef } from '../config/enemies';
import { SURFACE, type Point, type TileType } from '../config/map';
import { SQUASH, depthAt, liftOf, project } from '../config/view';

export interface EnemyOptions {
  /** Start this far along the route (split and summoned enemies appear where their parent is). */
  progress?: number;
  /** How many splits or summons deep this enemy is, so splitting can't go on forever. */
  generation?: number;
  /** The ground under a point: sand, ice and lava slow or burn walkers, and it sets how high everything is drawn. */
  ground?: (x: number, y: number) => TileType | undefined;
}

/** Empty pixels under an enemy's feet in its picture. */
const FOOT = 3;

/**
 * A walker, flyer or boat that follows its route until it dies or reaches the castle.
 * It moves on the flat map (`pos`); the picture stands upright at that point in the angled view.
 */
export class Enemy extends Phaser.GameObjects.Image {
  readonly def: EnemyDef;
  readonly maxHp: number;
  /** The wave's health multiplier, so healing scales with the enemies it heals. */
  readonly hpMultiplier: number;
  readonly speedMultiplier: number;
  readonly generation: number;
  /** The route this enemy follows, so its children can follow it too. */
  readonly route: Point[];
  hp: number;
  /** Soaks up damage before health does. */
  shield = 0;
  /** Pixels travelled along the route. */
  progress = 0;
  /** Total length of this enemy's route; enemies on the shortcut have a shorter one. */
  readonly routeLength: number;
  dead = false;
  escaped = false;
  /** Logical position on the route (the sprite adds a small bob on top). */
  pos: Point;
  /** Seconds until a Shaman heals again. */
  healTimer: number;
  /** Seconds until it next attacks a tower. */
  attackTimer = 0;
  /** Set by the game each frame: a revealing tower can see it. */
  revealed = false;
  /** Set when hit; the game reads it for "on hit" abilities and clears it. */
  wasHit = false;
  /** Per-ability timers and once-only flags for triggered abilities. */
  readonly abilityTimers: number[];
  readonly abilityFired: boolean[];
  hitCooldown = 0;

  private readonly speed: number;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly cum: number[];
  private readonly ground?: (x: number, y: number) => TileType | undefined;
  private segment = 0;
  private slowFactor = 1;
  private slowTimer = 0;
  private frozenTimer = 0;
  private flashTimer = 0;
  private cloakTimer = 0;
  private boost = 1;
  private boostTimer = 0;
  private burnDps = 0;
  private burnTimer = 0;
  private burnTick = 0;
  private walkFrame = -1;
  private flapTime = Math.random();
  /** How high the feet are above the ground right now (a bob, or a flyer's height). */
  private bob = 0;

  constructor(scene: Phaser.Scene, def: EnemyDef, path: Point[], hpMultiplier: number, speedMultiplier = 1, opts: EnemyOptions = {}) {
    super(scene, path[0].x, path[0].y, `${def.texture}_0`);
    this.def = def;
    this.route = path;
    this.pos = { x: path[0].x, y: path[0].y };
    this.hpMultiplier = hpMultiplier;
    this.speedMultiplier = speedMultiplier;
    this.generation = opts.generation ?? 0;
    this.maxHp = Math.max(1, Math.round(def.hp * hpMultiplier));
    this.hp = this.maxHp;
    this.shield = Math.round((def.shield ?? 0) * this.maxHp);
    this.speed = def.speed * speedMultiplier;
    this.cum = [0];
    for (let i = 1; i < path.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y));
    this.routeLength = this.cum[this.cum.length - 1];
    this.healTimer = def.heal?.interval ?? 0;
    this.attackTimer = def.attack ? 1 / def.attack.rate : 0;
    const abilities = def.abilities ?? [];
    this.abilityTimers = abilities.map((a) => (a.when.kind === 'every' ? a.when.seconds : 0));
    this.abilityFired = abilities.map(() => false);
    this.ground = opts.ground;
    const scale = def.scale ?? 1;
    this.setScale(scale);
    this.setOrigin(0.5, 1);
    this.shadow = scene.add
      .image(this.pos.x, this.pos.y, 'shadow')
      .setDepth(DEPTH.flat + 0.5)
      .setScale(scale * (def.flying ? 0.8 : 1), scale * SQUASH)
      .setAlpha(def.flying ? 0.6 : 1)
      .setVisible(!def.boat);
    scene.add.existing(this);
    if (opts.progress) this.moveTo(Math.min(opts.progress, this.routeLength - 1));
    this.place();
  }

  get flying(): boolean {
    return this.def.flying === true;
  }

  get boat(): boolean {
    return this.def.boat === true;
  }

  /** Walks on the road, so traps and road surfaces affect it. */
  get walking(): boolean {
    return !this.flying && !this.boat;
  }

  get isSlowed(): boolean {
    return this.slowTimer > 0 || this.frozenTimer > 0;
  }

  get isFrozen(): boolean {
    return this.frozenTimer > 0;
  }

  get targetable(): boolean {
    return !this.dead && !this.escaped;
  }

  /** Stealthy or cloaked, and no revealing tower nearby. */
  get hidden(): boolean {
    return (this.def.stealth === true || this.cloakTimer > 0) && !this.revealed;
  }

  /** Could hide if no tower reveals it (the game only checks reveal range for these). */
  get canHide(): boolean {
    return this.def.stealth === true || this.cloakTimer > 0;
  }

  /** Towers can aim at it. */
  get seen(): boolean {
    return this.targetable && !this.hidden;
  }

  /** How high this enemy's ground stands (see view.ts): walkers are on the road, boats on water. */
  get lift(): number {
    const t = this.ground?.(this.pos.x, this.pos.y);
    return liftOf(t ?? (this.boat ? 'water' : 'path'));
  }

  /** Height of the body's middle above the ground, where shots aim and health bars hang. */
  get bodyZ(): number {
    return this.bob + this.displayHeight / 2 - FOOT * this.scaleX;
  }

  /** Where the body's middle is drawn, for effects and messages. */
  get screen(): Point {
    return project(this.pos.x, this.pos.y, this.bodyZ, this.lift);
  }

  /** Pixels left to the castle; towers aiming at "first" pick the smallest. */
  get remaining(): number {
    return this.routeLength - this.progress;
  }

  step(dt: number): void {
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) this.slowFactor = 1;
    }
    if (this.frozenTimer > 0) this.frozenTimer -= dt;
    if (this.flashTimer > 0) this.flashTimer -= dt;
    if (this.cloakTimer > 0) this.cloakTimer -= dt;
    if (this.hitCooldown > 0) this.hitCooldown -= dt;
    if (this.boostTimer > 0) {
      this.boostTimer -= dt;
      if (this.boostTimer <= 0) this.boost = 1;
    }

    const surface = this.ground?.(this.pos.x, this.pos.y);
    if (this.def.regen && this.hp < this.maxHp) this.heal(this.def.regen * this.maxHp * dt);
    if (this.burnTimer > 0) {
      this.burnTimer -= dt;
      this.burnTick += this.burnDps * dt;
    }
    if (surface === 'lava') this.burnTick += SURFACE.lavaDps * this.hpMultiplier * dt;
    if (this.burnTick >= 1) {
      const dmg = Math.floor(this.burnTick);
      this.burnTick -= dmg;
      this.hurt(dmg);
    }

    // Frozen enemies stand still; bosses are only half frozen.
    const freeze = this.frozenTimer > 0 ? (this.def.boss ? 0.5 : 0) : 1;
    const ground = surface === 'sand' ? SURFACE.sand : surface === 'ice' ? SURFACE.ice : 1;
    const move = this.speed * this.slowFactor * freeze * this.boost * ground * dt;
    this.moveTo(this.progress + move);
    if (this.progress >= this.routeLength) this.escaped = true;

    let frame: number;
    if (this.flying) {
      // Flyers flap on a timer and hover well above their shadow.
      this.flapTime += dt * freeze;
      frame = Math.floor(this.flapTime * 5) % 2;
      this.bob = (14 + Math.sin(this.flapTime * 4) * 2) * this.scaleX;
    } else if (this.boat) {
      // Boats rock gently on the water.
      this.flapTime += dt;
      frame = Math.floor(this.progress / 12) % 2;
      this.bob = (1 + Math.sin(this.flapTime * 3) * 1) * this.scaleX;
    } else {
      // Walkers step with distance travelled, plus a 1px bob.
      frame = Math.floor(this.progress / 9) % 2;
      this.bob = frame * this.scaleX;
    }
    if (frame !== this.walkFrame) {
      this.walkFrame = frame;
      this.setTexture(`${this.def.texture}_${frame}`);
    }
    this.place();

    // Hidden enemies show as a faint shimmer so players know something is there.
    const hidden = this.hidden;
    this.setAlpha(hidden ? 0.3 : 1);
    this.shadow.setAlpha(hidden ? 0.2 : this.flying ? 0.6 : 1);
    if (this.flashTimer > 0) this.setTintFill(0xffffff);
    else if (this.frozenTimer > 0) this.setTint(0x9fe7ff);
    else if (this.slowTimer > 0) this.setTint(0x73eff7);
    else if (this.burnTimer > 0) this.setTint(0xffa060);
    else if (this.def.tint !== undefined) this.setTint(this.def.tint);
    else this.clearTint();
  }

  /** Applies a hit after shield and armour. Returns the damage actually dealt. */
  hit(damage: number, pierce = false): number {
    if (this.dead) return 0;
    const armor = pierce ? 0 : (this.def.armor ?? 0);
    const dealt = armor > 0 ? Math.max(Math.ceil(damage * 0.2), damage - armor) : damage;
    this.wasHit = true;
    this.flashTimer = 0.07;
    return this.hurt(dealt);
  }

  /** Damage that skips armour (burns, lava, poison clouds); the shield still soaks it. */
  hurt(amount: number): number {
    if (this.dead || amount <= 0) return 0;
    let left = amount;
    if (this.shield > 0) {
      const soaked = Math.min(this.shield, left);
      this.shield -= soaked;
      left -= soaked;
    }
    this.hp -= left;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
    }
    return amount;
  }

  heal(amount: number): void {
    if (this.dead) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  addShield(amount: number): void {
    this.shield = Math.max(this.shield, Math.round(amount));
  }

  slow(factor: number, duration: number): void {
    if (this.def.slowImmune) return;
    this.slowFactor = Math.min(this.slowFactor, factor);
    this.slowTimer = Math.max(this.slowTimer, duration);
  }

  freeze(duration: number): void {
    this.frozenTimer = Math.max(this.frozenTimer, duration);
  }

  burn(dps: number, duration: number): void {
    this.burnDps = Math.max(this.burnTimer > 0 ? this.burnDps : 0, dps);
    this.burnTimer = Math.max(this.burnTimer, duration);
  }

  cloak(duration: number): void {
    this.cloakTimer = Math.max(this.cloakTimer, duration);
  }

  sprint(factor: number, duration: number): void {
    this.boost = Math.max(this.boost, factor);
    this.boostTimer = Math.max(this.boostTimer, duration);
  }

  /** Moves back along the route (knockback). */
  pushBack(px: number): void {
    this.moveTo(Math.max(0, this.progress - px));
  }

  /** Jumps forward along the route, stopping just short of the end. */
  jump(px: number): void {
    this.moveTo(Math.min(this.routeLength - 2, this.progress + px));
  }

  destroy(fromScene?: boolean): void {
    this.shadow?.destroy();
    super.destroy(fromScene);
  }

  /** Draws the enemy standing at its map point, and its shadow on the ground under it. */
  private place(): void {
    const lift = this.lift;
    const feet = project(this.pos.x, this.pos.y, this.bob, lift);
    this.setPosition(feet.x, feet.y + FOOT * this.scaleX);
    const ground = project(this.pos.x, this.pos.y, 0, lift);
    this.shadow.setPosition(ground.x, ground.y);
    this.setDepth(depthAt(this.flying ? DEPTH.flying : DEPTH.standing, this.pos.y));
  }

  /** Puts the enemy at a distance along its route and faces it the way it walks. */
  private moveTo(progress: number): void {
    this.progress = Math.max(0, progress);
    const { cum, route } = this;
    let i = Math.min(this.segment, cum.length - 2);
    while (i < cum.length - 2 && cum[i + 1] < this.progress) i++;
    while (i > 0 && cum[i] > this.progress) i--;
    this.segment = Math.max(0, i);
    if (route.length < 2) return;
    const a = route[this.segment];
    const b = route[this.segment + 1];
    const len = cum[this.segment + 1] - cum[this.segment] || 1;
    const t = Math.min(1, Math.max(0, (this.progress - cum[this.segment]) / len));
    this.pos.x = a.x + (b.x - a.x) * t;
    this.pos.y = a.y + (b.y - a.y) * t;
    if (b.x !== a.x) this.setFlipX(b.x < a.x);
  }
}
