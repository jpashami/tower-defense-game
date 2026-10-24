import Phaser from 'phaser';
import { DEPTH } from '../config/constants';
import type { TowerDef, TowerStats } from '../config/towers';
import type { Enemy } from './Enemy';

/** A shot that homes on its target. If the target dies first, it lands where the target was. */
export class Projectile extends Phaser.GameObjects.Image {
  readonly tower: TowerDef;
  readonly stats: TowerStats;
  readonly target: Enemy;
  /** Damage this shot deals (after any critical hit). */
  readonly damage: number;
  readonly crit: boolean;
  done = false;
  tx: number;
  ty: number;

  private readonly startDist: number;
  private travelled = 0;
  private readonly arcs: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, tower: TowerDef, stats: TowerStats, target: Enemy, damage: number, crit = false) {
    super(scene, x, y, tower.projectileTexture);
    this.tower = tower;
    this.stats = stats;
    this.target = target;
    this.damage = damage;
    this.crit = crit;
    this.tx = target.pos.x;
    this.ty = target.aimY;
    this.startDist = Math.max(1, Math.hypot(this.tx - x, this.ty - y));
    this.arcs = tower.shot === 'shell' || tower.shot === 'rock';
    if (tower.shotTint !== undefined) this.setTint(tower.shotTint);
    this.setDepth(DEPTH.projectile);
    scene.add.existing(this);
  }

  /** Ignores armour (Ballista bolts). */
  get pierce(): boolean {
    return this.tower.pierce === true;
  }

  /** Moves the shot; returns true on the frame it lands. */
  step(dt: number): boolean {
    if (this.done) return false;
    if (this.target.targetable) {
      this.tx = this.target.pos.x;
      this.ty = this.target.aimY;
    }
    const dx = this.tx - this.x;
    const dy = this.ty - this.y;
    const dist = Math.hypot(dx, dy);
    const move = this.stats.projectileSpeed * dt;
    if (dist <= move) {
      this.setPosition(this.tx, this.ty);
      this.done = true;
      return true;
    }
    this.x += (dx / dist) * move;
    this.y += (dy / dist) * move;
    this.travelled += move;
    this.setRotation(Math.atan2(dy, dx));
    if (this.arcs) {
      // Cannonballs grow mid-flight to fake a lob.
      const t = Math.min(1, this.travelled / this.startDist);
      this.setScale(1 + Math.sin(t * Math.PI) * 0.6);
    }
    return false;
  }
}
