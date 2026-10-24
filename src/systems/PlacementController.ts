import Phaser from 'phaser';
import { DEPTH, TILE } from '../config/constants';
import type { TowerDef } from '../config/towers';
import type { TrapDef } from '../config/traps';

/** Holds the tower or trap being placed and shows a see-through preview under the cursor. */
export class PlacementController {
  /** Key of the tower or trap being placed. */
  type: string | null = null;
  /** Placing a road trap rather than a tower. */
  isTrap = false;
  hover: { col: number; row: number } | null = null;

  private readonly base: Phaser.GameObjects.Image;
  private readonly head: Phaser.GameObjects.Image;
  private tint: number | undefined;

  constructor(scene: Phaser.Scene) {
    this.base = scene.add.image(0, 0, 'base_archer').setAlpha(0.7).setDepth(DEPTH.ghost).setVisible(false);
    this.head = scene.add.image(0, 0, 'head_archer').setAlpha(0.7).setDepth(DEPTH.ghost).setVisible(false);
  }

  begin(def: TowerDef): void {
    this.type = def.key;
    this.isTrap = false;
    this.tint = def.tint;
    this.base.setTexture(def.baseTexture);
    this.head.setTexture(def.headTexture).setRotation(def.rotates ? -Math.PI / 2 : 0);
    this.refresh();
  }

  beginTrap(def: TrapDef): void {
    this.type = def.key;
    this.isTrap = true;
    this.tint = def.tint;
    this.base.setTexture(def.texture);
    this.refresh();
  }

  cancel(): void {
    this.type = null;
    this.isTrap = false;
    this.refresh();
  }

  setHover(cell: { col: number; row: number } | null): void {
    this.hover = cell;
    this.refresh();
  }

  /** Red tint when the spot is invalid or unaffordable. */
  setValid(valid: boolean): void {
    for (const img of [this.base, this.head]) {
      if (!valid) img.setTint(0xff5050);
      else if (this.tint !== undefined) img.setTint(this.tint);
      else img.clearTint();
    }
  }

  private refresh(): void {
    const show = this.type !== null && this.hover !== null;
    this.base.setVisible(show);
    this.head.setVisible(show && !this.isTrap);
    if (show && this.hover) {
      const x = this.hover.col * TILE + TILE / 2;
      const y = this.hover.row * TILE + TILE / 2;
      this.base.setPosition(x, y);
      this.head.setPosition(x, y);
    }
  }
}
