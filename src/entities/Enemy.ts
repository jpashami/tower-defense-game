import Phaser from 'phaser';
import { DEPTH } from '../config/constants';
import type { EnemyDef } from '../config/enemies';
import type { Point } from '../config/map';

/** A walker that follows the path corners until it dies or reaches the castle. */
export class Enemy extends Phaser.GameObjects.Image {
  readonly def: EnemyDef;
  readonly maxHp: number;
  hp: number;
  /** Pixels walked along the path; towers target the highest value. */
  progress = 0;
  dead = false;
  escaped = false;
  /** Logical position on the path (the sprite adds a little hop on top). */
  pos: Point;

  private readonly path: Point[];
  private nextIndex = 1;
  private slowFactor = 1;
  private slowTimer = 0;
  private flashTimer = 0;
  private hopPhase = Math.random() * Math.PI * 2;

  constructor(scene: Phaser.Scene, def: EnemyDef, path: Point[], hpMultiplier: number) {
    super(scene, path[0].x, path[0].y, def.texture);
    this.def = def;
    this.path = path;
    this.pos = { x: path[0].x, y: path[0].y };
    this.maxHp = Math.round(def.hp * hpMultiplier);
    this.hp = this.maxHp;
    scene.add.existing(this);
  }

  get isSlowed(): boolean {
    return this.slowTimer > 0;
  }

  get targetable(): boolean {
    return !this.dead && !this.escaped;
  }

  step(dt: number): void {
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) this.slowFactor = 1;
    }
    if (this.flashTimer > 0) this.flashTimer -= dt;

    let move = this.def.speed * this.slowFactor * dt;
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

    // A small hop while walking; slowed enemies hop slower.
    this.hopPhase += dt * 10 * this.slowFactor;
    this.setPosition(this.pos.x, this.pos.y - Math.abs(Math.sin(this.hopPhase)) * 2);
    this.setDepth(DEPTH.enemy + this.pos.y / 1000);

    if (this.flashTimer > 0) this.setTintFill(0xffffff);
    else if (this.isSlowed) this.setTint(0x73eff7);
    else this.clearTint();
  }

  hit(damage: number): void {
    if (this.dead) return;
    this.hp -= damage;
    this.flashTimer = 0.07;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
    }
  }

  slow(factor: number, duration: number): void {
    this.slowFactor = Math.min(this.slowFactor, factor);
    this.slowTimer = Math.max(this.slowTimer, duration);
  }
}
