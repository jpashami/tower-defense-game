import Phaser from 'phaser';
import { DEPTH } from '../config/constants';
import type { TowerDef, TowerStats } from '../config/towers';
import { project } from '../config/view';
import type { Enemy } from './Enemy';

/** Where a shot starts: a map point, how high above the ground, and the ground's own height. */
export interface ShotOrigin {
  x: number;
  y: number;
  z: number;
  lift: number;
}

/**
 * A shot that homes on its target. If the target dies first, it lands where the target was.
 * It flies across the flat map (`wx`, `wy`) and rises or falls between the tower's height and
 * the target's body; the picture is drawn where the angled view puts that.
 */
export class Projectile extends Phaser.GameObjects.Image {
  readonly tower: TowerDef;
  readonly stats: TowerStats;
  readonly target: Enemy;
  /** Damage this shot deals (after any critical hit). */
  readonly damage: number;
  readonly crit: boolean;
  done = false;
  /** Map point it is heading for. */
  tx: number;
  ty: number;

  private wx: number;
  private wy: number;
  private tz: number;
  private tlift: number;
  private readonly z0: number;
  private readonly lift0: number;
  private readonly startDist: number;
  private travelled = 0;
  private readonly arcs: boolean;

  constructor(scene: Phaser.Scene, from: ShotOrigin, tower: TowerDef, stats: TowerStats, target: Enemy, damage: number, crit = false) {
    const start = project(from.x, from.y, from.z, from.lift);
    super(scene, start.x, start.y, tower.projectileTexture);
    this.tower = tower;
    this.stats = stats;
    this.target = target;
    this.damage = damage;
    this.crit = crit;
    this.wx = from.x;
    this.wy = from.y;
    this.z0 = from.z;
    this.lift0 = from.lift;
    this.tx = target.pos.x;
    this.ty = target.pos.y;
    this.tz = target.bodyZ;
    this.tlift = target.lift;
    this.startDist = Math.max(1, Math.hypot(this.tx - from.x, this.ty - from.y));
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
      this.ty = this.target.pos.y;
      this.tz = this.target.bodyZ;
      this.tlift = this.target.lift;
    }
    const dx = this.tx - this.wx;
    const dy = this.ty - this.wy;
    const dist = Math.hypot(dx, dy);
    const move = this.stats.projectileSpeed * dt;
    const wasAt = { x: this.x, y: this.y };
    if (dist <= move) {
      this.wx = this.tx;
      this.wy = this.ty;
      this.travelled = this.startDist;
      this.done = true;
    } else {
      this.wx += (dx / dist) * move;
      this.wy += (dy / dist) * move;
      this.travelled += move;
    }
    // Height and ground level slide from the tower's to the target's over the flight.
    const t = Math.min(1, this.travelled / this.startDist);
    const z = this.z0 + (this.tz - this.z0) * t;
    const lift = this.lift0 + (this.tlift - this.lift0) * t;
    const p = project(this.wx, this.wy, z, lift);
    this.setPosition(p.x, p.y);
    this.setRotation(Math.atan2(p.y - wasAt.y, p.x - wasAt.x));
    if (this.arcs) {
      // Cannonballs grow mid-flight to fake a lob.
      this.setScale(1 + Math.sin(t * Math.PI) * 0.6);
    }
    return this.done;
  }
}
