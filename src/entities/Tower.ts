import Phaser from 'phaser';
import { standingTexture } from '../art/standing';
import { DEPTH, SELL_REFUND, TILE } from '../config/constants';
import { TARGET_MODES, TOWER_HP, type TargetMode, type TowerDef, type TowerStats } from '../config/towers';
import { SQUASH, TILE_H, depthAt, liftOf, project } from '../config/view';
import type { Enemy } from './Enemy';
import type { ShotOrigin } from './Projectile';

/** Share of what a tower cost that repairing it after it breaks costs. */
export const REPAIR_SHARE = 0.3;
/** How tall a tower's base block stands, in screen pixels. */
export const BASE_HEIGHT = 8;

/**
 * A built tower: picks targets by its targeting mode and fires when ready.
 * It sits at the middle of its square on the flat map (`x`, `y`); the pictures are drawn
 * where the angled view puts that: a base block standing on the (raised) grass with the
 * head on its top face. Turning heads lie flat on that face; others stand up.
 */
export class Tower {
  readonly def: TowerDef;
  readonly col: number;
  readonly row: number;
  readonly x: number;
  readonly y: number;
  /** How high this square's ground stands (grass is raised; see view.ts). */
  readonly lift: number;
  level = 0;
  /** Total gold spent on this tower, used for the sell refund. */
  spent: number;
  targetMode: TargetMode;
  /** Health; only enemies that attack towers lower it. */
  hp: number;
  /** Broken towers don't shoot until repaired. */
  broken = false;

  private readonly scene: Phaser.Scene;
  private readonly base: Phaser.GameObjects.Image;
  private readonly head: Phaser.GameObjects.Image;
  /** Holds a turning head and squashes it onto the slanted top face. */
  private readonly headHolder: Phaser.GameObjects.Container;
  private readonly pips: Phaser.GameObjects.Image[] = [];
  private cooldown = 0.25;
  private stunTimer = 0;

  constructor(scene: Phaser.Scene, def: TowerDef, col: number, row: number, lift = liftOf('grass')) {
    this.scene = scene;
    this.def = def;
    this.col = col;
    this.row = row;
    this.x = col * TILE + TILE / 2;
    this.y = row * TILE + TILE / 2;
    this.lift = lift;
    this.spent = def.cost;
    this.targetMode = def.defaultTarget;
    this.hp = this.maxHp;
    const ground = project(this.x, this.y, 0, lift);
    const depth = depthAt(DEPTH.standing, this.y);
    this.base = scene.add
      .image(ground.x, ground.y + TILE_H / 2, standingTexture(scene, def.baseTexture, BASE_HEIGHT))
      .setOrigin(0.5, 1)
      .setDepth(depth);
    this.head = scene.add.image(0, 0, def.headTexture);
    this.headHolder = scene.add.container(ground.x, ground.y - BASE_HEIGHT, [this.head]).setDepth(depth + 0.00005);
    if (def.tint !== undefined) {
      this.base.setTint(def.tint);
      this.head.setTint(def.tint);
    }
    if (def.rotates) {
      this.head.setRotation(-Math.PI / 2);
      this.headHolder.setScale(1, SQUASH);
    } else {
      this.head.setOrigin(0.5, 0.7);
      scene.tweens.add({
        targets: this.head,
        scale: 1.1,
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    // Pop in.
    this.base.setScale(0.4);
    scene.tweens.add({ targets: this.base, scale: 1, duration: 180, ease: 'Back.easeOut' });
  }

  get stats(): TowerStats {
    return this.def.levels[this.level];
  }

  get maxHp(): number {
    return Math.round((this.def.hp ?? TOWER_HP) * (1 + 0.5 * this.level));
  }

  get isMaxLevel(): boolean {
    return this.level >= this.def.levels.length - 1;
  }

  /** Cost of the next level, or null at max level. */
  get upgradeCost(): number | null {
    return this.isMaxLevel ? null : this.def.upgradeCosts[this.level];
  }

  get sellValue(): number {
    return Math.floor(this.spent * SELL_REFUND);
  }

  get repairCost(): number {
    return Math.max(1, Math.ceil(this.spent * REPAIR_SHARE));
  }

  get stunned(): boolean {
    return this.stunTimer > 0;
  }

  /** Where the tower's head is drawn, for effects and messages. */
  get top(): { x: number; y: number } {
    return { x: this.headHolder.x, y: this.headHolder.y };
  }

  /** Where the tower stands on the drawn ground. */
  get foot(): { x: number; y: number } {
    return project(this.x, this.y, 0, this.lift);
  }

  /** Whether this tower can shoot that enemy at all (flyers need an air-capable tower; hidden ones can't be seen). */
  canHit(e: Enemy): boolean {
    return e.seen && (!e.flying || this.def.hitsAir);
  }

  inRange(e: Enemy, range = this.stats.range): boolean {
    const dx = e.pos.x - this.x;
    const dy = e.pos.y - this.y;
    return dx * dx + dy * dy <= range * range;
  }

  /**
   * Advances the reload (at `rate` speed, slowed by enemy auras) and returns the
   * enemies to shoot at, if a shot is ready: one, or several for multi-shot towers.
   */
  update(dt: number, enemies: readonly Enemy[], rate = 1): Enemy[] | null {
    if (this.stunTimer > 0) this.stunTimer -= dt;
    if (this.broken || this.stunTimer > 0) return null;
    this.cooldown -= dt * rate;
    const targets = this.pickTargets(enemies, this.def.multiShot ?? 1);
    if (targets.length === 0) return null;

    if (this.def.rotates) {
      this.head.setRotation(Phaser.Math.Angle.Between(this.x, this.y, targets[0].pos.x, targets[0].pos.y));
    }
    if (this.cooldown > 0) return null;
    this.cooldown = this.stats.cooldown;
    this.recoil();
    return targets;
  }

  /** Where projectiles leave the tower: a map point and its height above the ground. */
  muzzle(): ShotOrigin {
    const z = BASE_HEIGHT + (this.def.rotates ? 4 : 14);
    if (!this.def.rotates) return { x: this.x, y: this.y, z, lift: this.lift };
    const r = this.head.rotation;
    return { x: this.x + Math.cos(r) * 12, y: this.y + Math.sin(r) * 12, z, lift: this.lift };
  }

  cycleTarget(): void {
    const i = TARGET_MODES.indexOf(this.targetMode);
    this.targetMode = TARGET_MODES[(i + 1) % TARGET_MODES.length];
  }

  upgrade(): void {
    const cost = this.upgradeCost;
    if (cost === null) return;
    const before = this.maxHp;
    this.spent += cost;
    this.level++;
    if (!this.broken) this.hp += this.maxHp - before;
    const pip = this.scene.add
      .image(this.headHolder.x + 11 - (this.level - 1) * 7, this.headHolder.y - 11 * SQUASH, 'pip')
      .setDepth(this.headHolder.depth + 0.00001);
    this.pips.push(pip);
    this.scene.tweens.add({
      targets: [this.base, this.head],
      scale: { from: 1.25, to: 1 },
      duration: 220,
      ease: 'Back.easeOut',
    });
  }

  /** An enemy hits the tower. Returns true if this broke it. */
  damage(amount: number): boolean {
    if (this.broken) return false;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp > 0) return false;
    this.broken = true;
    this.base.setTint(0x566c86);
    this.head.setTint(0x566c86).setAlpha(0.6);
    return true;
  }

  stun(seconds: number): void {
    this.stunTimer = Math.max(this.stunTimer, seconds);
  }

  /** Fixes a broken tower (or tops up a damaged one). */
  repair(): void {
    this.hp = this.maxHp;
    if (!this.broken) return;
    this.broken = false;
    this.head.setAlpha(1);
    if (this.def.tint !== undefined) {
      this.base.setTint(this.def.tint);
      this.head.setTint(this.def.tint);
    } else {
      this.base.clearTint();
      this.head.clearTint();
    }
  }

  destroy(): void {
    this.scene.tweens.killTweensOf([this.base, this.head]);
    this.base.destroy();
    this.headHolder.destroy();
    this.pips.forEach((p) => p.destroy());
  }

  private pickTargets(enemies: readonly Enemy[], count: number): Enemy[] {
    const scored: { e: Enemy; score: number }[] = [];
    for (const e of enemies) {
      if (!this.canHit(e) || !this.inRange(e)) continue;
      let score: number;
      if (this.targetMode === 'strongest') score = e.hp;
      else if (this.targetMode === 'closest') score = -Math.hypot(e.pos.x - this.x, e.pos.y - this.y);
      else score = -e.remaining;
      // Frost towers prefer enemies that are not already chilled.
      if (this.stats.slow && !e.isSlowed && !e.def.slowImmune) score += 1e6;
      scored.push({ e, score });
    }
    if (count <= 1) {
      let best: { e: Enemy; score: number } | null = null;
      for (const s of scored) if (!best || s.score > best.score) best = s;
      return best ? [best.e] : [];
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, count).map((s) => s.e);
  }

  private recoil(): void {
    if (!this.def.rotates) return;
    const r = this.head.rotation;
    this.head.setPosition(-Math.cos(r) * 3, -Math.sin(r) * 3);
    this.scene.tweens.add({ targets: this.head, x: 0, y: 0, duration: 120, ease: 'Quad.easeOut' });
  }
}
