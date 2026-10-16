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
  /** Logical position on the path (the sprite adds a small walk bob on top). */
  pos: Point;

  private readonly path: Point[];
  private nextIndex = 1;
  private slowFactor = 1;
  private slowTimer = 0;
  private flashTimer = 0;
  private readonly shadow: Phaser.GameObjects.Image;
  private walkFrame = -1;

  constructor(scene: Phaser.Scene, def: EnemyDef, path: Point[], hpMultiplier: number) {
    super(scene, path[0].x, path[0].y, `${def.texture}_0`);
    this.def = def;
    this.path = path;
    this.pos = { x: path[0].x, y: path[0].y };
    this.maxHp = Math.round(def.hp * hpMultiplier);
    this.hp = this.maxHp;
    this.shadow = scene.add.image(this.pos.x, this.pos.y + 13, 'shadow').setDepth(DEPTH.deco + 0.5);
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

    // Two-frame walk cycle driven by distance walked, plus a 1px bob.
    const frame = Math.floor(this.progress / 9) % 2;
    if (frame !== this.walkFrame) {
      this.walkFrame = frame;
      this.setTexture(`${this.def.texture}_${frame}`);
    }
    this.setPosition(this.pos.x, this.pos.y - 2 - frame);
    this.shadow.setPosition(this.pos.x, this.pos.y + 13);
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

  destroy(fromScene?: boolean): void {
    this.shadow?.destroy();
    super.destroy(fromScene);
  }

  slow(factor: number, duration: number): void {
    this.slowFactor = Math.min(this.slowFactor, factor);
    this.slowTimer = Math.max(this.slowTimer, duration);
  }
}
