import Phaser from 'phaser';
import { DEPTH, SELL_REFUND, TILE } from '../config/constants';
import type { TrapDef } from '../config/traps';
import { SQUASH, project } from '../config/view';
import type { Enemy } from './Enemy';

/** A trap on a road square. The game decides when walkers set it off. */
export class Trap {
  readonly def: TrapDef;
  readonly col: number;
  readonly row: number;
  readonly x: number;
  readonly y: number;
  /** Bombs: ready to go off. */
  armed = true;
  /** Spikes: enemies left to hurt before the strip breaks. */
  usesLeft: number;
  spent: number;
  /** Enemies already hurt by these spikes, so each is only hurt once. */
  readonly hurt = new WeakSet<Enemy>();

  private readonly image: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, def: TrapDef, col: number, row: number) {
    this.def = def;
    this.col = col;
    this.row = row;
    this.x = col * TILE + TILE / 2;
    this.y = row * TILE + TILE / 2;
    this.usesLeft = def.uses;
    this.spent = def.cost;
    // Traps lie flat on the road, so they are drawn squashed to the ground's slant.
    const p = project(this.x, this.y);
    this.image = scene.add.image(p.x, p.y, def.texture).setDepth(DEPTH.flat + 0.2);
    if (def.tint !== undefined) this.image.setTint(def.tint);
    this.image.setScale(0.4, 0.4 * SQUASH);
    scene.tweens.add({ targets: this.image, scaleX: 1, scaleY: SQUASH, duration: 180, ease: 'Back.easeOut' });
  }

  get sellValue(): number {
    return Math.floor(this.spent * SELL_REFUND);
  }

  /** Where the trap is drawn, for messages. */
  get screen(): { x: number; y: number } {
    return { x: this.image.x, y: this.image.y };
  }

  /** Whether an enemy standing at this point is on the trap. */
  covers(e: Enemy): boolean {
    return Math.abs(e.pos.x - this.x) < TILE / 2 && Math.abs(e.pos.y - this.y) < TILE / 2;
  }

  /** A bomb has gone off: show the scorch mark until it is rearmed. */
  setArmed(armed: boolean): void {
    this.armed = armed;
    this.image.setTexture(armed ? this.def.texture : `${this.def.texture}_spent`);
  }

  destroy(): void {
    this.image.destroy();
  }
}
