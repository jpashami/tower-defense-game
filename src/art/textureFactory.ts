import Phaser from 'phaser';
import { PALETTE } from './palette';

/**
 * Paints a character grid into a new canvas texture.
 * Every grid cell becomes a `scale` x `scale` block of solid colour.
 */
export function makePixelTexture(
  scene: Phaser.Scene,
  key: string,
  grid: string[],
  scale: number,
): void {
  if (scene.textures.exists(key)) return;
  const height = grid.length;
  const width = Math.max(...grid.map((row) => row.length));
  const texture = scene.textures.createCanvas(key, width * scale, height * scale);
  if (!texture) throw new Error(`Could not create texture "${key}"`);
  const ctx = texture.getContext();

  for (let y = 0; y < height; y++) {
    const row = grid[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const colour = PALETTE[ch];
      if (!colour) {
        console.warn(`Unknown palette char "${ch}" in sprite "${key}"`);
        continue;
      }
      ctx.fillStyle = colour;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  texture.refresh();
}
