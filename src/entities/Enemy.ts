import Phaser from 'phaser';
import { DEPTH } from '../config/constants';
import type { EnemyDef } from '../config/enemies';
import { routeLength, type Point } from '../config/map';

/** A walker (or flyer) that follows its route until it dies or reaches the castle. */
export class Enemy extends Phaser.GameObjects.Image {
  readonly def: EnemyDef;
  readonly maxHp: number;
  /** The wave's health multiplier, so healing scales with the enemies it heals. */
  readonly hpMultiplier: number;
  hp: number;
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

  private readonly path: Point[];
  private readonly speed: number;
  private readonly shadow: Phaser.GameObjects.Image;
  private nextIndex = 1;
  private slowFactor = 1;
  private slowTimer = 0;
  private frozenTimer = 0;
  private flashTimer = 0;
  private walkFrame = -1;
  private flapTime = Math.random();

  constructor(scene: Phaser.Scene, def: EnemyDef, path: Point[], hpMultiplier: number, speedMultiplier = 1) {
    super(scene, path[0].x, path[0].y, `${def.texture}_0`);
    this.def = def;
    this.path = path;
    this.pos = { x: path[0].x, y: path[0].y };
    this.hpMultiplier = hpMultiplier;
    this.maxHp = Math.round(def.hp * hpMultiplier);
    this.hp = this.maxHp;
    this.speed = def.speed * speedMultiplier;
    this.routeLength = routeLength(path);
    this.healTimer = def.heal?.interval ?? 0;
    const scale = def.scale ?? 1;
    this.setScale(scale);
    this.shadow = scene.add
      .image(this.pos.x, this.pos.y, 'shadow')
      .setDepth(DEPTH.deco + 0.5)
      .setScale(scale * (def.flying ? 0.8 : 1))
      .setAlpha(def.flying ? 0.6 : 1);
    scene.add.existing(this);
  }

  get flying(): boolean {
    return this.def.flying === true;
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

  /** Where shots should aim: the body, which for flyers is well above the ground. */
  get aimY(): number {
    return this.pos.y - (this.flying ? 14 : 2) * (this.def.scale ?? 1);
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

    // Frozen enemies stand still; bosses are only half frozen.
    const freeze = this.frozenTimer > 0 ? (this.def.boss ? 0.5 : 0) : 1;
    let move = this.speed * this.slowFactor * freeze * dt;
    while (move > 0 && this.nextIndex < this.path.length) {
      const target = this.path[this.nextIndex];
      const dx = target.x - this.pos.x;
      const dy = target.y - this.pos.y;
      const dist = Math.hypot(dx, dy);
      if (dx !== 0) this.setFlipX(dx < 0);
      if (dist <= move) {
        this.pos.x = target.x;
        this.pos.y = target.y;
        this.progress += dist;
        move -= dist;
        this.nextIndex++;
      } else {
        this.pos.x += (dx / dist) * move;
        this.pos.y += (dy / dist) * move;
        this.progress += move;
        move = 0;
      }
    }
    if (this.nextIndex >= this.path.length) this.escaped = true;

    let frame: number;
    let lift: number;
    if (this.flying) {
      // Flyers flap on a timer and hover well above their shadow.
      this.flapTime += dt * freeze;
      frame = Math.floor(this.flapTime * 5) % 2;
      lift = 14 + Math.sin(this.flapTime * 4) * 2;
      this.setDepth(DEPTH.flying + this.pos.y / 1000);
    } else {
      // Walkers step with distance travelled, plus a 1px bob.
      frame = Math.floor(this.progress / 9) % 2;
      lift = 2 + frame;
      this.setDepth(DEPTH.enemy + this.pos.y / 1000);
    }
    if (frame !== this.walkFrame) {
      this.walkFrame = frame;
      this.setTexture(`${this.def.texture}_${frame}`);
    }
    this.setPosition(this.pos.x, this.pos.y - lift * (this.def.scale ?? 1));
    this.shadow.setPosition(this.pos.x, this.pos.y + 13);

    if (this.flashTimer > 0) this.setTintFill(0xffffff);
    else if (this.frozenTimer > 0) this.setTint(0x9fe7ff);
    else if (this.slowTimer > 0) this.setTint(0x73eff7);
    else this.clearTint();
  }

  /** Applies a hit after armour. Returns the damage actually dealt. */
  hit(damage: number, pierce = false): number {
    if (this.dead) return 0;
    const armor = pierce ? 0 : (this.def.armor ?? 0);
    const dealt = armor > 0 ? Math.max(Math.ceil(damage * 0.2), damage - armor) : damage;
    this.hp -= dealt;
    this.flashTimer = 0.07;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
    }
    return dealt;
  }

  heal(amount: number): void {
    if (this.dead) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  slow(factor: number, duration: number): void {
    if (this.def.slowImmune) return;
    this.slowFactor = Math.min(this.slowFactor, factor);
    this.slowTimer = Math.max(this.slowTimer, duration);
  }

  freeze(duration: number): void {
    this.frozenTimer = Math.max(this.frozenTimer, duration);
  }

  destroy(fromScene?: boolean): void {
    this.shadow?.destroy();
    super.destroy(fromScene);
  }
}
