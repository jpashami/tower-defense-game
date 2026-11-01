import Phaser from 'phaser';
import { standingTexture } from '../art/standing';
import { DEPTH, TILE } from '../config/constants';
import type { TowerDef } from '../config/towers';
import type { TrapDef } from '../config/traps';
import { SQUASH, TILE_H, project } from '../config/view';
import { BASE_HEIGHT } from '../entities/Tower';

/** Holds the tower or trap being placed and shows a see-through preview under the cursor. */
export class PlacementController {
  /** Key of the tower or trap being placed. */
  type: string | null = null;
  /** Placing a road trap rather than a tower. */
  isTrap = false;
  hover: { col: number; row: number } | null = null;

  private readonly scene: Phaser.Scene;
  private readonly base: Phaser.GameObjects.Image;
  private readonly head: Phaser.GameObjects.Image;
  /** Squashes a turning head onto the slanted ground, like a built tower's. */
  private readonly headHolder: Phaser.GameObjects.Container;
  private tint: number | undefined;
  private lift = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.base = scene.add.image(0, 0, 'base_archer').setOrigin(0.5, 1).setAlpha(0.7).setDepth(DEPTH.ghost).setVisible(false);
    this.head = scene.add.image(0, 0, 'head_archer').setAlpha(0.7);
    this.headHolder = scene.add.container(0, 0, [this.head]).setDepth(DEPTH.ghost + 0.1).setVisible(false);
  }

  begin(def: TowerDef): void {
    this.type = def.key;
    this.isTrap = false;
    this.tint = def.tint;
    this.base.setTexture(standingTexture(this.scene, def.baseTexture, BASE_HEIGHT)).setOrigin(0.5, 1).setScale(1);
    this.head.setTexture(def.headTexture).setRotation(def.rotates ? -Math.PI / 2 : 0).setOrigin(0.5, def.rotates ? 0.5 : 0.7);
    this.headHolder.setScale(1, def.rotates ? SQUASH : 1);
    this.refresh();
  }

  beginTrap(def: TrapDef): void {
    this.type = def.key;
    this.isTrap = true;
    this.tint = def.tint;
    this.base.setTexture(def.texture).setOrigin(0.5, 0.5).setScale(1, SQUASH);
    this.refresh();
  }

  cancel(): void {
    this.type = null;
    this.isTrap = false;
    this.refresh();
  }

  /** `lift` is how high the hovered square's ground stands (see view.ts). */
  setHover(cell: { col: number; row: number } | null, lift = 0): void {
    this.hover = cell;
    this.lift = lift;
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
    this.headHolder.setVisible(show && !this.isTrap);
    if (show && this.hover) {
      const x = this.hover.col * TILE + TILE / 2;
      const y = this.hover.row * TILE + TILE / 2;
      const p = project(x, y, 0, this.lift);
      if (this.isTrap) {
        this.base.setPosition(p.x, p.y);
      } else {
        this.base.setPosition(p.x, p.y + TILE_H / 2);
        this.headHolder.setPosition(p.x, p.y - BASE_HEIGHT);
      }
    }
  }
}
