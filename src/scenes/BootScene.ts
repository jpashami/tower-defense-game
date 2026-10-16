import Phaser from 'phaser';
import { buildSprites } from '../art/sprites';
import { makePixelTexture } from '../art/textureFactory';

/** Builds every texture from the pixel art definitions, then opens the menu. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    for (const [key, { grid, scale }] of Object.entries(buildSprites())) {
      makePixelTexture(this, key, grid, scale);
    }
    this.scene.start('Menu');
  }
}
