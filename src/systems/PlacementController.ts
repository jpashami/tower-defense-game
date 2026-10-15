import Phaser from 'phaser';
import { DEPTH, TILE } from '../config/constants';
import { TOWERS, type TowerKey } from '../config/towers';

/** Holds the tower type being placed and shows a see-through preview under the cursor. */
export class PlacementController {
  type: TowerKey | null = null;
  hover: { col: number; row: number } | null = null;

  private readonly base: Phaser.GameObjects.Image;
  private readonly head: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene) {
    this.base = scene.add.image(0, 0, 'base_archer').setAlpha(0.7).setDepth(DEPTH.ghost).setVisible(false);
    this.head = scene.add.image(0, 0, 'head_archer').setAlpha(0.7).setDepth(DEPTH.ghost).setVisible(false);
  }

  begin(type: TowerKey): void {
    this.type = type;
    const def = TOWERS[type];
    this.base.setTexture(def.baseTexture);
    this.head.setTexture(def.headTexture).setRotation(def.rotates ? -Math.PI / 2 : 0);
    this.refresh();
  }

  cancel(): void {
    this.type = null;
    this.refresh();
  }

  setHover(cell: { col: number; row: number } | null): void {
    this.hover = cell;
    this.refresh();
  }

  /** Red tint when the spot is invalid or unaffordable. */
  setValid(valid: boolean): void {
    for (const img of [this.base, this.head]) {
      if (valid) img.clearTint();
      else img.setTint(0xff5050);
    }
  }

  private refresh(): void {
    const show = this.type !== null && this.hover !== null;
    this.base.setVisible(show);
    this.head.setVisible(show);
    if (show && this.hover) {
      const x = this.hover.col * TILE + TILE / 2;
      const y = this.hover.row * TILE + TILE / 2;
      this.base.setPosition(x, y);
      this.head.setPosition(x, y);
    }
  }
}
