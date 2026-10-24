import type Phaser from 'phaser';
import { makePixelTexture } from '../art/textureFactory';
import type { GameContent } from './compile';

/** Paints a version's own drawings into textures (once; keys include the version's hash). */
export function ensureVersionTextures(scene: Phaser.Scene, content: GameContent): void {
  for (const [key, s] of Object.entries(content.sprites)) makePixelTexture(scene, key, s.grid, s.scale, s.palette);
}
