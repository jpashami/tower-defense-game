import Phaser from 'phaser';
import { buildSprites } from '../art/sprites';
import { makePixelTexture } from '../art/textureFactory';

/** Builds every texture from the pixel art definitions, then opens the menu. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    // Let every scene hear every press. Otherwise the HUD, which still thinks the pointer
    // is over the button it just pressed (a tap jumps without moving), swallows the
    // next press on the map. Scenes ignore presses outside their own area themselves.
    this.input.setGlobalTopOnly(false);
    for (const [key, { grid, scale }] of Object.entries(buildSprites())) {
      makePixelTexture(this, key, grid, scale);
    }
    this.scene.start('Menu');
  }
}
