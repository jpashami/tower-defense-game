import Phaser from 'phaser';
import { DEPTH, SELL_REFUND, TILE } from '../config/constants';
import { TARGET_MODES, type TargetMode, type TowerDef, type TowerStats } from '../config/towers';
import type { Enemy } from './Enemy';

/** A built tower: picks a target by its targeting mode and fires when ready. */
export class Tower {
  readonly def: TowerDef;
  readonly col: number;
  readonly row: number;
  readonly x: number;
  readonly y: number;
  level = 0;
  /** Total gold spent on this tower, used for the sell refund. */
  spent: number;
  targetMode: TargetMode;

  private readonly scene: Phaser.Scene;
  private readonly base: Phaser.GameObjects.Image;
  private readonly head: Phaser.GameObjects.Image;
  private readonly pips: Phaser.GameObjects.Image[] = [];
  private cooldown = 0.25;

  constructor(scene: Phaser.Scene, def: TowerDef, col: number, row: number) {
    this.scene = scene;
    this.def = def;
    this.col = col;
    this.row = row;
    this.x = col * TILE + TILE / 2;
    this.y = row * TILE + TILE / 2;
    this.spent = def.cost;
    this.targetMode = def.defaultTarget;
    this.base = scene.add.image(this.x, this.y, def.baseTexture).setDepth(DEPTH.towerBase);
    this.head = scene.add.image(this.x, this.y, def.headTexture).setDepth(DEPTH.towerHead);
    if (def.rotates) this.head.setRotation(-Math.PI / 2);
    else {
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

  /** Whether this tower can shoot that enemy at all (flyers need an air-capable tower). */
  canHit(e: Enemy): boolean {
    return e.targetable && (!e.flying || this.def.hitsAir);
  }

  inRange(e: Enemy, range = this.stats.range): boolean {
    const dx = e.pos.x - this.x;
    const dy = e.pos.y - this.y;
    return dx * dx + dy * dy <= range * range;
  }

  /** Advances the cooldown and returns an enemy to shoot at, if a shot is ready. */
  update(dt: number, enemies: Enemy[]): Enemy | null {
    this.cooldown -= dt;
    const target = this.pickTarget(enemies);
    if (!target) return null;

    if (this.def.rotates) {
      this.head.setRotation(Phaser.Math.Angle.Between(this.x, this.y, target.pos.x, target.pos.y));
    }
    if (this.cooldown > 0) return null;
    this.cooldown = this.stats.cooldown;
    this.recoil();
    return target;
  }

  /** Where projectiles leave the tower. */
  muzzle(): { x: number; y: number } {
    if (!this.def.rotates) return { x: this.x, y: this.y - 4 };
    const r = this.head.rotation;
    return { x: this.x + Math.cos(r) * 12, y: this.y + Math.sin(r) * 12 };
  }

  cycleTarget(): void {
    const i = TARGET_MODES.indexOf(this.targetMode);
    this.targetMode = TARGET_MODES[(i + 1) % TARGET_MODES.length];
  }

  upgrade(): void {
    const cost = this.upgradeCost;
    if (cost === null) return;
    this.spent += cost;
    this.level++;
    const pip = this.scene.add
      .image(this.x + 11 - (this.level - 1) * 7, this.y - 11, 'pip')
      .setDepth(DEPTH.towerHead + 0.1);
    this.pips.push(pip);
    this.scene.tweens.add({
      targets: [this.base, this.head],
      scale: { from: 1.25, to: 1 },
      duration: 220,
      ease: 'Back.easeOut',
    });
  }

  destroy(): void {
    this.scene.tweens.killTweensOf([this.base, this.head]);
    this.base.destroy();
    this.head.destroy();
    this.pips.forEach((p) => p.destroy());
  }

  private pickTarget(enemies: Enemy[]): Enemy | null {
    let best: Enemy | null = null;
    let bestScore = -Infinity;
    for (const e of enemies) {
      if (!this.canHit(e) || !this.inRange(e)) continue;
      let score: number;
      if (this.targetMode === 'strongest') score = e.hp;
      else if (this.targetMode === 'closest') score = -Math.hypot(e.pos.x - this.x, e.pos.y - this.y);
      else score = -e.remaining;
      // Frost towers prefer enemies that are not already chilled.
      if (this.stats.slow && !e.isSlowed && !e.def.slowImmune) score += 1e6;
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  private recoil(): void {
    if (!this.def.rotates) return;
    const r = this.head.rotation;
    this.head.setPosition(this.x - Math.cos(r) * 3, this.y - Math.sin(r) * 3);
    this.scene.tweens.add({ targets: this.head, x: this.x, y: this.y, duration: 120, ease: 'Quad.easeOut' });
  }
}
