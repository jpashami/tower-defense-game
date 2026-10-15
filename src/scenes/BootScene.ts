import Phaser from 'phaser';
import { PIXEL_SCALE } from '../config/constants';
import { SPRITES, grassGrid, pathGrid } from '../art/sprites';
import { makePixelTexture } from '../art/textureFactory';
import { GRASS_VARIANTS, PATH_VARIANTS } from '../systems/MapRenderer';

/** Builds every texture from the pixel grids, then opens the menu. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    for (const [key, grid] of Object.entries(SPRITES)) {
      makePixelTexture(this, key, grid, PIXEL_SCALE);
    }
    for (let i = 0; i < GRASS_VARIANTS; i++) makePixelTexture(this, `tile_grass_${i}`, grassGrid(101 + i * 17), PIXEL_SCALE);
    for (let i = 0; i < PATH_VARIANTS; i++) makePixelTexture(this, `tile_path_${i}`, pathGrid(503 + i * 31), PIXEL_SCALE);
    this.scene.start('Menu');
  }
}
